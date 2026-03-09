// scripts/signin.js

async function handleSignIn(event) {
  if (event) event.preventDefault();

  const email = document.getElementById('signin-email').value.trim();
  const password = document.getElementById('signin-password').value.trim();

  if (!email || !password) {
    alert('Email and password are required!');
    return;
  }

  try {
    let user, token, userRole, username;

    // A. Demo Login Bypass for @smartdesk.com accounts
    if (email.toLowerCase().endsWith('@smartdesk.com')) {
      const response = await fetch('/api/signin/demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Professional login failed');

      token = data.token;
      user = data.user;
      userRole = user.role;
      username = user.username;
    }
    // B. Standard Supabase Auth
    else {
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      token = data.session.access_token;
      user = data.user;
      userRole = user.user_metadata?.role || 'customer';
      username = user.user_metadata?.username || email.split('@')[0];
    }

    // 2. Set standard session info (backward compatibility)
    setToken(token);

    // 2b. Force sync with database to ensure public profile exists
    try {
      await syncUserProfile(username, userRole);
    } catch (syncErr) {
      console.warn('Sync failed, using local fallback:', syncErr);
    }

    setCurrentUser({
      ...user,
      role: userRole,
      username: username
    });

    // 3. Redirect based on role
    if (userRole === 'admin') {
      window.location.href = 'admin.html';
    } else if (userRole === 'agent') {
      window.location.href = 'agent.html';
    } else {
      window.location.href = 'customer.html';
    }
  } catch (error) {
    alert(error.message);
    console.error('Signin error:', error);
  }
}

// Event listener for button click
document.addEventListener('DOMContentLoaded', function () {
  const signinButton = document.querySelector('.btn-primary');
  if (signinButton) {
    signinButton.onclick = handleSignIn;
  }
});

// Utility to check if user is logged in
async function checkAuth() {
  const currentUser = getCurrentUser();
  const token = await getToken();

  if (!currentUser || !token) {
    window.location.href = 'signin.html';
    return null;
  }
  return currentUser;
}

// Toggle password visibility
function togglePassword(inputId, icon) {
  const input = document.getElementById(inputId);
  if (input.type === 'password') {
    input.type = 'text';
    icon.classList.remove('fa-eye');
    icon.classList.add('fa-eye-slash');
  } else {
    input.type = 'password';
    icon.classList.remove('fa-eye-slash');
    icon.classList.add('fa-eye');
  }
}

// Handle Forgot Password
async function handleForgotPassword(e) {
  if (e) e.preventDefault();
  const email = prompt("Please enter your email address to reset your password:");
  if (!email) return;

  if (email.toLowerCase().endsWith('@smartdesk.com')) {
    alert("Professional demo accounts cannot reset their password via email. Please contact HeadAdmin.");
    return;
  }

  try {
    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/html/reset-password.html'
    });
    if (error) throw error;
    alert("Password reset email sent! Please check your inbox.");
  } catch (error) {
    alert("Error: " + error.message);
  }
}