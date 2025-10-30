/**
 * Quote Wizard - Form handling & validation
 */

document.addEventListener('DOMContentLoaded', () => {
  // Character counter for notes textarea
  const notesTextarea = document.getElementById('notes');
  if (notesTextarea) {
    const charCountSpan = document.getElementById('charCount');

    function updateCharCount() {
      const { length } = notesTextarea.value;
      charCountSpan.textContent = length;

      if (length > 180) {
        charCountSpan.style.color = 'var(--color-warning-600)';
      } else {
        charCountSpan.style.color = 'var(--text-tertiary)';
      }
    }

    notesTextarea.addEventListener('input', updateCharCount);
    updateCharCount(); // Initial count
  }

  // Step 1 Form Submit
  const step1Form = document.getElementById('step1-form');
  if (step1Form) {
    step1Form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const formData = new FormData(step1Form);

      // Get all checked event types
      const eventTypes = [];
      document.querySelectorAll('input[name="eventTypes"]:checked').forEach((checkbox) => {
        eventTypes.push(checkbox.value);
      });

      const data = {
        eventDate: formData.get('eventDate'),
        eventDateFlexible: document.getElementById('eventDateFlexible')?.checked || false,
        eventTime: formData.get('eventTime'),
        eventTimeFlexible: document.getElementById('eventTimeFlexible')?.checked || false,
        eventLocation: formData.get('eventLocation'),
        eventType: formData.get('eventType'),
        eventTypes,
        guestCount: formData.get('guestCount'),
        eventName: formData.get('eventName'),
        eventCategory: formData.get('eventCategory')
      };

      // Validation
      if (!data.eventDate || !data.eventTime || !data.eventLocation || !data.eventType || !data.guestCount || !data.eventName || !data.eventCategory) {
        alert('Kérjük, töltsd ki az összes kötelező mezőt!');
        return;
      }

      // Submit to backend
      const performerSlug = window.location.pathname.split('/')[2];
      const submitButton = step1Form.querySelector('button[type="submit"]');
      submitButton.disabled = true;
      submitButton.textContent = 'Mentés...';

      try {
        const response = await fetch(`/ajanlat/${performerSlug}/step/1`, {
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

  // Step 2 Form Submit
  const step2Form = document.getElementById('step2Form');
  if (step2Form) {
    step2Form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const formData = new FormData(step2Form);

      const data = {
        contactName: formData.get('contactName'),
        contactEmail: formData.get('contactEmail'),
        contactPhone: formData.get('contactPhone') || '',
        notes: formData.get('notes') || ''
      };

      // Validation
      if (!data.contactName || !data.contactEmail) {
        alert('Kérjük, add meg a nevedet és az e-mail címedet!');
        return;
      }

      // Email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.contactEmail)) {
        alert('Kérjük, adj meg egy érvényes e-mail címet!');
        return;
      }

      // Submit to backend
      const pathParts = window.location.pathname.split('/');
      const performerSlug = pathParts[2];

      // Check if we're on a recommendation flow (no performer slug or slug is empty/step/etc)
      const isRecommendation = !performerSlug || performerSlug === 'step' || window.location.pathname === '/ajanlat';
      const endpoint = isRecommendation ? '/ajanlat/step/2' : `/ajanlat/${performerSlug}/step/2`;

      console.log('Step 2 submit:', {
        pathname: window.location.pathname,
        pathParts,
        performerSlug,
        isRecommendation,
        endpoint
      });

      const submitButton = step2Form.querySelector('button[type="submit"]');
      submitButton.disabled = true;
      submitButton.textContent = 'Mentés...';

      try {
        const response = await fetch(endpoint, {
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
          submitButton.textContent = 'Tovább az összegzéshez';
        }
      } catch (error) {
        console.error('Error:', error);
        alert('Hiba történt az adatok mentése során.');
        submitButton.disabled = false;
        submitButton.textContent = 'Tovább az összegzéshez';
      }
    });
  }

  // Step 3 Form Submit (Final)
  const step3Form = document.getElementById('step3Form');
  if (step3Form) {
    step3Form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const pathParts = window.location.pathname.split('/');
      const performerSlug = pathParts[2];
      const endpoint = performerSlug ? `/ajanlat/${performerSlug}/submit` : '/ajanlat/submit';

      const submitButton = step3Form.querySelector('button[type="submit"]');
      submitButton.disabled = true;
      submitButton.innerHTML = '<span>Küldés...</span>';

      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        });

        const result = await response.json();

        if (result.success) {
          window.location.href = result.redirect;
        } else {
          alert(`Hiba történt: ${result.message}`);
          submitButton.disabled = false;
          submitButton.innerHTML = 'Ajánlatot kérek <svg width="20" height="20" fill="currentColor" viewBox="0 0 20 20"><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/></svg>';
        }
      } catch (error) {
        console.error('Error:', error);
        alert('Hiba történt az ajánlatkérés küldése során.');
        submitButton.disabled = false;
        submitButton.innerHTML = 'Ajánlatot kérek <svg width="20" height="20" fill="currentColor" viewBox="0 0 20 20"><path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/><path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/></svg>';
      }
    });
  }
});
