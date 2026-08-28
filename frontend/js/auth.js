/* ============================================================
   auth.js — login / signup form handling
   ============================================================ */

function initAuthForm(formId, { endpoint, redirectTo = 'index.html' }) {
  const form = document.getElementById(formId);
  if (!form) return;
  const errorBox = document.getElementById('authError');
  const submitBtn = form.querySelector('button[type="submit"]');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBox.textContent = '';
    errorBox.classList.remove('visible');

    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());

    submitBtn.disabled = true;
    submitBtn.textContent = 'Please wait…';

    try {
      const { token, user } = await api.post(endpoint, payload, { auth: false });
      setSession(token, user);
      window.location.href = redirectTo;
    } catch (err) {
      errorBox.textContent = err.message || 'Something went wrong. Please try again.';
      errorBox.classList.add('visible');
      submitBtn.disabled = false;
      submitBtn.textContent = formId === 'loginForm' ? 'Log In' : 'Sign Up';
    }
  });
}

function requireAuth() {
  if (!isLoggedIn()) {
    window.location.href = 'login.html';
  }
}

function logout() {
  clearSession();
  window.location.href = 'login.html';
}
