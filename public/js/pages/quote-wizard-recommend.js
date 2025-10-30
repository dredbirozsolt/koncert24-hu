/**
 * Quote Wizard - Recommendation Flow (without performer)
 * Form handling & validation
 */

document.addEventListener('DOMContentLoaded', () => {
  // Step 1 Form Submit
  const step1Form = document.getElementById('step1-form');
  if (step1Form) {
    step1Form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const formData = new FormData(step1Form);

      // Get all checked styles
      const styles = [];
      document.querySelectorAll('input[name="styles"]:checked').forEach((checkbox) => {
        styles.push(checkbox.value);
      });

      const data = {
        eventDate: formData.get('eventDate'),
        eventDateFlexible: document.getElementById('eventDateFlexible')?.checked || false,
        eventTime: formData.get('eventTime'),
        eventTimeFlexible: document.getElementById('eventTimeFlexible')?.checked || false,
        eventLocation: formData.get('eventLocation'),
        performerCount: formData.get('performerCount'),
        budget: parseInt(document.getElementById('budget').value),
        styles,
        eventType: formData.get('eventType'),
        guestCount: formData.get('guestCount'),
        eventName: formData.get('eventName'),
        eventCategory: formData.get('eventCategory')
      };

      // Validation with specific error messages
      if (!data.eventDate) {
        alert('Kérjük, válassz dátumot!');
        return;
      }
      if (!data.eventTime) {
        alert('Kérjük, válassz időpontot!');
        return;
      }
      if (!data.eventLocation) {
        alert('Kérjük, add meg a helyszínt!');
        return;
      }
      if (!data.performerCount) {
        alert('Kérjük, válaszd ki, hogy egy vagy több előadót szeretnél!');
        return;
      }
      if (!data.budget || data.budget <= 0) {
        alert('Kérjük, állítsd be a költségkeretet!');
        return;
      }
      if (styles.length === 0) {
        alert('Kérjük, válassz legalább egy stílust!');
        return;
      }
      if (!data.eventType) {
        alert('Kérjük, válassz műsor típust!');
        return;
      }
      if (!data.guestCount) {
        alert('Kérjük, válaszd ki a várható vendégszámot!');
        return;
      }
      if (!data.eventName) {
        alert('Kérjük, add meg a rendezvény nevét!');
        return;
      }
      if (!data.eventCategory) {
        alert('Kérjük, válassz esemény jelleget!');
        return;
      }

      // Submit to backend
      const submitButton = step1Form.querySelector('button[type="submit"]');
      submitButton.disabled = true;
      submitButton.textContent = 'Mentés...';

      try {
        const response = await fetch('/ajanlat/step/1', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(data)
        });

        const result = await response.json();

        if (result.success) {
          window.location.href = result.redirect;
        } else {
          alert(`Hiba történt: ${result.message}`);
          submitButton.disabled = false;
          submitButton.textContent = 'Tovább a következő lépésre';
        }
      } catch (error) {
        console.error('Error:', error);
        alert('Hiba történt az adatok mentése során.');
        submitButton.disabled = false;
        submitButton.textContent = 'Tovább a következő lépésre';
      }
    });
  }
});
