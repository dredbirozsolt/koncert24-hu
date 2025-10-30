const { VTigerService } = require('./vtigerService');
const { Event, Performer } = require('../models');
const { Op } = require('sequelize');
const logger = require('../config/logger');

// VTiger service instance létrehozása
const vtigerService = new VTigerService();

/**
 * HTML entitások dekódolása
 * @param {string} text - Dekódolandó szöveg
 * @returns {string} Dekódolt szöveg
 */
function decodeHtmlEntities(text) {
  if (!text) {return text;}

  const entities = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&nbsp;': ' ',
    '&aacute;': 'á',
    '&Aacute;': 'Á',
    '&eacute;': 'é',
    '&Eacute;': 'É',
    '&iacute;': 'í',
    '&Iacute;': 'Í',
    '&oacute;': 'ó',
    '&Oacute;': 'Ó',
    '&ouml;': 'ö',
    '&Ouml;': 'Ö',
    '&odoubleacute;': 'ő',
    '&Odoubleacute;': 'Ő',
    '&uacute;': 'ú',
    '&Uacute;': 'Ú',
    '&uuml;': 'ü',
    '&Uuml;': 'Ü',
    '&udoubleacute;': 'ű',
    '&Udoubleacute;': 'Ű'
  };

  let decoded = text;
  for (const [entity, char] of Object.entries(entities)) {
    decoded = decoded.replace(new RegExp(entity, 'g'), char);
  }

  return decoded;
}

class EventSyncService {
  /**
   * Helper: Query építése
   */
  buildSalesOrderQuery(startDate, endDate, offset, limit) {
    return 'SELECT id, sostatus, subject, cf_793, cf_795, cf_813 FROM SalesOrder '
      + `WHERE sostatus='Approved' AND cf_793 >= '${startDate}' AND cf_793 <= '${endDate}' `
      + `LIMIT ${offset}, ${limit};`;
  }

  /**
   * Helper: Egy lapnyi Sales Order lekérése
   */
  async fetchSalesOrderPage(startDate, endDate, offset, limit) {
    const query = this.buildSalesOrderQuery(startDate, endDate, offset, limit);
    const salesOrders = await vtigerService.query(query);

    if (!salesOrders || salesOrders.length === 0) {
      return { salesOrders: [], hasMore: false };
    }

    // Removed verbose pagination log - covered by summary

    return {
      salesOrders,
      hasMore: salesOrders.length >= limit
    };
  }

  /**
   * Helper: Fetch all sales orders with pagination from vTiger
   * @param {string} startDate - Start date for filtering
   * @param {string} endDate - End date for filtering
   * @returns {Array} All sales orders in date range
   */
  async fetchAllSalesOrders(startDate, endDate) {
    const allSalesOrders = [];
    let offset = 0;
    const limit = 100;
    let hasMore = true;
    let totalFetched = 0;

    while (hasMore) {
      try {
        const { salesOrders, hasMore: hasMoreResults } = await this.fetchSalesOrderPage(
          startDate,
          endDate,
          offset,
          limit,
          totalFetched
        );

        if (salesOrders.length > 0) {
          allSalesOrders.push(...salesOrders);
          totalFetched += salesOrders.length;
        }

        hasMore = hasMoreResults;
        if (hasMore) {
          offset += limit;
        }
      } catch (error) {
        logger.error({
          service: 'eventSync',
          operation: 'paginatedFetch',
          offset,
          limit,
          error: error.message
        }, 'Pagination error during event sync');
        hasMore = false;
      }
    }

    return allSalesOrders;
  }

  /**
   * Helper: Dátum határok meghatározása
   */
  getDateRange(options) {
    const today = new Date();
    const defaultStartDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const defaultEndDate = new Date(today.getFullYear(), today.getMonth() + 2, 0);
    const startDate = options.startDate || defaultStartDate.toISOString().split('T')[0];
    const endDate = options.endDate || defaultEndDate.toISOString().split('T')[0];
    return { startDate, endDate };
  }

  /**
   * Helper: Sales Orders feldolgozása
   */
  async processSalesOrders(salesOrders, stats) {
    for (const basicOrder of salesOrders) {
      stats.processed += 1;

      try {
        const fullOrder = await vtigerService.retrieve(basicOrder.id);
        await this.processSalesOrder(fullOrder, stats);
      } catch (error) {
        stats.errors += 1;
        stats.errorDetails.push({
          orderId: basicOrder.id || basicOrder.salesorder_no,
          error: error.message
        });
        logger.error({
          service: 'eventSync',
          operation: 'processEvent',
          orderId: basicOrder.id,
          orderNo: basicOrder.salesorder_no,
          error: error.message
        }, 'Event processing error');
      }
    }
  }

  /**
   * Helper: Időhatárokon kívül eső események törlése
   * @param {string} startDate - Kezdő dátum (ISO formátum)
   * @param {string} endDate - Vég dátum (ISO formátum)
   * @returns {number} Törölt események száma
   */
  async deleteEventsOutsideRange(startDate, endDate) {
    try {
      const deletedCount = await Event.destroy({
        where: {
          performanceDate: {
            [Op.or]: [
              { [Op.lt]: startDate },
              { [Op.gt]: endDate }
            ]
          }
        }
      });

      if (deletedCount > 0) {
        logger.info({
          service: 'eventSync',
          operation: 'deleteEventsOutsideRange',
          deletedCount,
          startDate,
          endDate
        }, 'Deleted events outside date range');
      }

      return deletedCount;
    } catch (error) {
      logger.error({
        err: error,
        service: 'eventSync',
        operation: 'deleteEventsOutsideRange',
        startDate,
        endDate
      }, 'Failed to delete events outside range');
      return 0;
    }
  }

  /**
   * Szinkronizálja a Vtiger Sales Order modulból a jóváhagyott eseményeket
   * @param {Object} options - Szinkronizációs opciók
   * @param {string} options.startDate - Kezdő dátum (ISO formátum)
   * @param {string} options.endDate - Vég dátum (ISO formátum)
   * @returns {Object} Szinkronizációs eredmény
   */
  async syncEvents(options = {}) {
    const startTime = Date.now();
    const stats = {
      processed: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
      deleted: 0,
      errorDetails: []
    };

    try {
      const { startDate, endDate } = this.getDateRange(options);
      const allSalesOrders = await this.fetchAllSalesOrders(startDate, endDate);

      if (allSalesOrders.length === 0) {
        return {
          ...stats,
          duration: Date.now() - startTime,
          message: 'Nem találhatók események a megadott időszakban'
        };
      }

      logger.info({
        service: 'eventSync',
        operation: 'syncEvents',
        count: allSalesOrders.length,
        startDate,
        endDate
      }, 'Event sync started');

      await this.processSalesOrders(allSalesOrders, stats);

      // Időhatárokon kívül eső események törlése
      const deletedCount = await this.deleteEventsOutsideRange(startDate, endDate);
      stats.deleted = deletedCount;

      const duration = Date.now() - startTime;

      logger.info({
        service: 'eventSync',
        operation: 'syncEvents',
        stats,
        duration
      }, 'Event sync completed');

      return {
        ...stats,
        duration,
        message: 'Szinkronizálás sikeres'
      };
    } catch (error) {
      logger.error({
        err: error,
        service: 'eventSync',
        operation: 'syncEvents'
      }, 'Event sync failed');
      throw error;
    }
  }

  /**
   * Feldolgoz egy Sales Order-t
   * @param {Object} order - Sales Order objektum
   * @param {Object} stats - Statisztika objektum
   */

  // Helper: Extract basic order data from vTiger Sales Order
  extractOrderData(order) {
    return {
      vtigerId: order.id,
      subject: order.subject || '',
      performanceDate: order.cf_793 || null,
      performanceTime: order.cf_795 || null,
      performanceLocation: order.cf_813 || null,
      status: order.sostatus || null
    };
  }

  // Helper: Extract item name and image from LineItems or productid
  async extractItemData(order) {
    const { id: vtigerId } = order;
    let itemName = null;
    let imageUrl = null;

    // Try LineItems array first
    if (order.LineItems && Array.isArray(order.LineItems) && order.LineItems.length > 0) {
      const firstItem = order.LineItems[0];
      const rawItemName = firstItem.product_name || firstItem.productid || null;
      itemName = decodeHtmlEntities(rawItemName);

      if (firstItem.productid) {
        imageUrl = await this.fetchProductImage(firstItem.productid, vtigerId);
      }
    } else if (order.productid) {
      // Fallback to productid field
      itemName = decodeHtmlEntities(order.productid);
      imageUrl = await this.fetchProductImage(order.productid, vtigerId);
    }

    return { itemName, imageUrl };
  }

  // Helper: Fetch product image from vTiger
  async fetchProductImage(productId, vtigerId) {
    try {
      const product = await vtigerService.retrieve(productId);

      if (product.imagename && product.imageattachmentids) {
        return vtigerService.generateImageUrl(product.imagename, product.imageattachmentids);
      }
      return null;
    } catch (error) {
      logger.warn({
        err: error,
        service: 'eventSync',
        productId,
        vtigerId
      }, 'Failed to fetch product image');
      return null;
    }
  }

  // Helper: Find performer by vTiger account_id or item name
  async findPerformerForOrder(order, itemName) {
    const { id: vtigerId, account_id: accountId } = order;

    // Try by vTiger Account connection first
    if (accountId) {
      const performer = await Performer.findOne({
        where: { vtigerId: accountId }
      });
      if (performer) {
        return performer.id;
      }
    }

    // Try by exact item name match
    if (itemName) {
      const performer = await Performer.findOne({
        where: { name: itemName }
      });

      if (performer) {
        return performer.id;
      }
      logger.warn({
        service: 'eventSync',
        itemName,
        vtigerId
      }, 'Performer not found by product name');
    }

    return null;
  }

  // Helper: Build event data object for upsert
  buildEventData(orderData, itemData, performerId, rawOrder) {
    return {
      vtigerId: orderData.vtigerId,
      subject: orderData.subject,
      performanceDate: orderData.performanceDate,
      performanceTime: orderData.performanceTime,
      performanceLocation: orderData.performanceLocation,
      itemName: itemData.itemName,
      status: orderData.status,
      performerId,
      imageUrl: itemData.imageUrl,
      rawData: rawOrder
    };
  }

  async processSalesOrder(order, stats) {
    const orderData = this.extractOrderData(order);
    const itemData = await this.extractItemData(order);
    const performerId = await this.findPerformerForOrder(order, itemData.itemName);
    const eventData = this.buildEventData(orderData, itemData, performerId, order);

    const [event, created] = await Event.upsert(eventData, { returning: true });

    if (created) {
      stats.created += 1;
      logger.info({
        service: 'eventSync',
        operation: 'createEvent',
        vtigerId: orderData.vtigerId,
        subject: orderData.subject,
        performanceDate: orderData.performanceDate
      }, 'Event created');
    } else {
      stats.updated += 1;
    }

    return event;
  }

  /**
   * Egy adott esemény újraszinkronizálása Vtiger-ből
   * @param {string} vtigerId - Vtiger Sales Order ID
   * @returns {Object} Frissített esemény
   */
  async syncSingleEvent(vtigerId) {
    try {
      const order = await vtigerService.retrieve(vtigerId);
      if (!order) {
        throw new Error(`Nem található Sales Order: ${vtigerId}`);
      }

      // Csak jóváhagyott státuszúakat szinkronizáljuk
      if (order.sostatus !== 'Approved') {
        throw new Error(`Az esemény státusza nem 'Approved': ${order.sostatus}`);
      }

      const stats = { created: 0, updated: 0, errors: 0, errorDetails: [] };
      await this.processSalesOrder(order, stats);

      logger.info({
        service: 'eventSync',
        operation: 'syncSingleEvent',
        vtigerId,
        created: stats.created,
        updated: stats.updated
      }, 'Event synced');

      return await Event.findOne({ where: { vtigerId } });
    } catch (error) {
      logger.error({
        service: 'eventSync',
        operation: 'syncSingleEvent',
        vtigerId,
        error: error.message
      }, 'Single event sync failed');
      throw error;
    }
  }

  /**
   * Összes esemény lekérdezése időrendben
   * @param {Object} options - Lekérdezési opciók
   * @returns {Array} Események listája
   */
  async getEvents(options = {}) {
    const {
      limit = 50,
      offset = 0,
      startDate = null,
      endDate = null,
      status = null
    } = options;

    const where = {};

    if (startDate) {
      where.performanceDate = where.performanceDate || {};
      where.performanceDate[Op.gte] = startDate;
    }

    if (endDate) {
      where.performanceDate = where.performanceDate || {};
      where.performanceDate[Op.lte] = endDate;
    }

    if (status) {
      where.status = status;
    }

    return await Event.findAll({
      where,
      include: [{
        model: Performer,
        as: 'performer',
        required: false
      }],
      order: [['performanceDate', 'ASC'], ['performanceTime', 'ASC']],
      limit,
      offset
    });
  }

  /**
   * Események száma
   * @param {Object} options - Szűrési opciók
   * @returns {number} Események száma
   */
  async getEventCount(options = {}) {
    const {
      startDate = null,
      endDate = null,
      status = null
    } = options;

    const where = {};

    if (startDate) {
      where.performanceDate = where.performanceDate || {};
      where.performanceDate[Op.gte] = startDate;
    }

    if (endDate) {
      where.performanceDate = where.performanceDate || {};
      where.performanceDate[Op.lte] = endDate;
    }

    if (status) {
      where.status = status;
    }

    return await Event.count({ where });
  }
}

module.exports = new EventSyncService();
