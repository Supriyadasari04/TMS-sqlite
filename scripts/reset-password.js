// scripts/reset-password.js

// Check if we arrived here with an access token in the URL hash (Supabase default behavior)
document.addEventListener("DOMContentLoaded", () => {
    const hashData = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = hashData.get('access_token');

    // Sometimes it's passed as a query param or fragment depending on framework
    if (!accessToken) {
        // Just verify if there's an active session from the redirect
        supabaseClient.auth.onAuthStateChange((event, session) => {
            if (event == 'PASSWORD_RECOVERY') {
                console.log('Recovery session active');
            }
        });
    }
});

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

async function handleResetPassword() {
    const newPassword = document.getElementById('reset-password').value.trim();
    const confirmPassword = document.getElementById('reset-confirm-password').value.trim();

    if (!newPassword || !confirmPassword) {
        alert("Please fill in both fields.");
        return;
    }

    if (newPassword !== confirmPassword) {
        alert("Passwords do not match.");
        return;
    }

    if (newPassword === 'Smartdesk@123') {
        alert("Please choose a different password than the default one.");
        return;
    }

    try {
        const btn = document.querySelector('.btn-primary');
        btn.disabled = true;
        btn.innerText = 'Updating...';

        const { data, error } = await supabaseClient.auth.updateUser({
            password: newPassword
        });

        if (error) throw error;

        // Sync the password to the backend if this was a Supabase user
        // The safest way is to hit a custom endpoint, but we don't have one that updates password directly,
        // actually Supabase updates the auth.users table on its own.
        // However, our backend has its own `password` field in `public.users` used for DEMO accounts.
        // If standard users want to reset password and login using custom jwt later, they may need it synced.
        // But standard users login via Supabase! So they don't need the bcrypt password updated on our end.

        alert("Your password has been successfully reset! Please sign in with your new password.");
        window.location.href = 'signin.html';

    } catch (error) {
        alert("Error: " + error.message);
        const btn = document.querySelector('.btn-primary');
        btn.disabled = false;
        btn.innerText = 'Update Password';
    }
}
