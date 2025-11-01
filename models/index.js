const { sequelize } = require('../config/database');
const Performer = require('./Performer');
const Booking = require('./Booking');
const Location = require('./Location');
const User = require('./User');
const Setting = require('./Setting');
const CronJob = require('./CronJob');
const CookieConsent = require('./CookieConsent');
const SecurityLog = require('./SecurityLog');
const Partner = require('./Partner');
const PartnerCategory = require('./PartnerCategory');
const Event = require('./Event');
const BlogPost = require('./BlogPost');
const BlogCategory = require('./BlogCategory');
const BlogTag = require('./BlogTag');
const FaqCategory = require('./FaqCategory');
const FaqItem = require('./FaqItem');
const AIBehaviorSetting = require('./AIBehaviorSetting');
const ChatSession = require('./ChatSession');
const ChatMessage = require('./ChatMessage');
const OfflineMessage = require('./OfflineMessage');
const BookingAvailability = require('./BookingAvailability');
const SystemStatus = require('./SystemStatus');
const Quote = require('./Quote');

// Initialize models
const LocationModel = Location(sequelize);
const PartnerModel = Partner(sequelize, require('sequelize').DataTypes);
const PartnerCategoryModel = PartnerCategory(sequelize, require('sequelize').DataTypes);
const EventModel = Event(sequelize, require('sequelize').DataTypes);
const BlogPostModel = BlogPost(sequelize, require('sequelize').DataTypes);
const BlogCategoryModel = BlogCategory(sequelize, require('sequelize').DataTypes);
const BlogTagModel = BlogTag(sequelize, require('sequelize').DataTypes);
const FaqCategoryModel = FaqCategory(sequelize, require('sequelize').DataTypes);
const FaqItemModel = FaqItem(sequelize, require('sequelize').DataTypes);
const AIBehaviorSettingModel = AIBehaviorSetting(sequelize, require('sequelize').DataTypes);
const ChatSessionModel = ChatSession(sequelize, require('sequelize').DataTypes);
const ChatMessageModel = ChatMessage(sequelize, require('sequelize').DataTypes);
const OfflineMessageModel = OfflineMessage(sequelize, require('sequelize').DataTypes);
const BookingAvailabilityModel = BookingAvailability(sequelize, require('sequelize').DataTypes);
const SystemStatusModel = SystemStatus(sequelize, require('sequelize').DataTypes);
const QuoteModel = Quote(sequelize, require('sequelize').DataTypes);

// Define associations
Booking.belongsTo(Performer, {
  foreignKey: 'performerId',
  as: 'performer'
});

Performer.hasMany(Booking, {
  foreignKey: 'performerId',
  as: 'bookings'
});

// User associations (for future features like user bookings)
Booking.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user',
  allowNull: true
});

User.hasMany(Booking, {
  foreignKey: 'userId',
  as: 'bookings'
});

// SecurityLog associations
SecurityLog.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user'
});

User.hasMany(SecurityLog, {
  foreignKey: 'userId',
  as: 'securityLogs'
});

// Event associations
EventModel.belongsTo(Performer, {
  foreignKey: 'performerId',
  as: 'performer'
});

Performer.hasMany(EventModel, {
  foreignKey: 'performerId',
  as: 'events'
});

// Partner Category associations
PartnerCategoryModel.hasMany(PartnerModel, {
  foreignKey: 'categoryId',
  as: 'partners'
});

PartnerModel.belongsTo(PartnerCategoryModel, {
  foreignKey: 'categoryId',
  as: 'category'
});

// CookieConsent associations
CookieConsent.belongsTo(User, {
  foreignKey: 'userId',
  as: 'user'
});

User.hasMany(CookieConsent, {
  foreignKey: 'userId',
  as: 'cookieConsents'
});

// Blog associations
BlogPostModel.belongsTo(User, {
  foreignKey: 'authorId',
  as: 'author'
});

User.hasMany(BlogPostModel, {
  foreignKey: 'authorId',
  as: 'blogPosts'
});

BlogPostModel.belongsTo(BlogCategoryModel, {
  foreignKey: 'categoryId',
  as: 'category'
});

BlogCategoryModel.hasMany(BlogPostModel, {
  foreignKey: 'categoryId',
  as: 'posts'
});

BlogPostModel.belongsToMany(BlogTagModel, {
  through: 'PostTags',
  foreignKey: 'postId',
  otherKey: 'tagId',
  as: 'tags'
});

BlogTagModel.belongsToMany(BlogPostModel, {
  through: 'PostTags',
  foreignKey: 'tagId',
  otherKey: 'postId',
  as: 'posts'
});

BlogCategoryModel.belongsTo(BlogCategoryModel, {
  foreignKey: 'parentId',
  as: 'parent'
});

BlogCategoryModel.hasMany(BlogCategoryModel, {
  foreignKey: 'parentId',
  as: 'children'
});

// FAQ associations
FaqCategoryModel.hasMany(FaqItemModel, {
  foreignKey: 'categoryId',
  as: 'items'
});

FaqItemModel.belongsTo(FaqCategoryModel, {
  foreignKey: 'categoryId',
  as: 'category'
});

// Quote associations
QuoteModel.belongsTo(Performer, {
  foreignKey: 'performerId',
  as: 'performer'
});

Performer.hasMany(QuoteModel, {
  foreignKey: 'performerId',
  as: 'quotes'
});

// Chat associations
ChatSessionModel.associate({ User, ChatMessage: ChatMessageModel });
ChatMessageModel.associate({ ChatSession: ChatSessionModel, User });
OfflineMessageModel.associate({ ChatSession: ChatSessionModel, User });
BookingAvailabilityModel.associate({ User });
SystemStatusModel.associate({});

module.exports = {
  sequelize,
  Performer,
  Booking,
  Location: LocationModel,
  User,
  Setting,
  CronJob,
  CookieConsent,
  SecurityLog,
  Partner: PartnerModel,
  PartnerCategory: PartnerCategoryModel,
  Event: EventModel,
  BlogPost: BlogPostModel,
  BlogCategory: BlogCategoryModel,
  BlogTag: BlogTagModel,
  FaqCategory: FaqCategoryModel,
  FaqItem: FaqItemModel,
  AIBehaviorSetting: AIBehaviorSettingModel,
  ChatSession: ChatSessionModel,
  ChatMessage: ChatMessageModel,
  OfflineMessage: OfflineMessageModel,
  BookingAvailability: BookingAvailabilityModel,
  SystemStatus: SystemStatusModel,
  Quote: QuoteModel
};
