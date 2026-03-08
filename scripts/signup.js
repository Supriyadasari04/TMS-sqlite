// scripts/signup.js

async function handleSignUp(event) {
    if (event) event.preventDefault();

    const email = document.getElementById('signup-email').value.trim();
    const username = document.getElementById('signup-username').value.trim();
    const password = document.getElementById('signup-password').value.trim();
    const confirm = document.getElementById('signup-confirm-password').value.trim();
    const role = document.getElementById('signup-role').value;

    if (!email || !username || !password || !role) {
        alert('Please fill in all fields.');
        return;
    }

    if (role !== 'customer' && !email.toLowerCase().endsWith('@smartdesk.com')) {
        alert('Only internal @smartdesk.com accounts can register as Agent or Admin. You have been defaulted to Customer.');
        document.getElementById('signup-role').value = 'customer';
        return;
    }

    if (password !== confirm) {
        alert('Passwords do not match!');
        return;
    }

    const signupBtn = document.querySelector('.btn-primary');
    signupBtn.disabled = true;
    signupBtn.innerText = 'Creating Account...';

    try {
        // 1. Sign up with Supabase Auth
        const { data, error } = await supabaseClient.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    username: username,
                    role: role
                }
            }
        });

        if (error) throw error;

        if (data.user) {
            // Check if email already existed in Supabase
            if (data.user.identities && data.user.identities.length === 0) {
                throw new Error("This email is already registered. Please sign in instead.");
            }
            // 2. Sync Profile to public.users (Critical for legacy compatibility)
            // If auto-confirm is OFF, session may be null. 
            // If ON, we can sync immediately. 
            if (data.session) {
                await syncUserProfile(username, role);
                alert('Welcome! Your professional account is ready.');
                window.location.href = role === 'admin' ? 'admin.html' : role === 'agent' ? 'agent.html' : 'customer.html';
            } else {
                alert('Account created! Please check your email (' + email + ') to confirm your professional profile.');
                window.location.href = 'signin.html';
            }
        }
    } catch (error) {
        alert(error.message);
        console.error('Signup error:', error);
    } finally {
        signupBtn.disabled = false;
        signupBtn.innerText = 'Create Account';
    }
}

// Event listener
document.addEventListener('DOMContentLoaded', () => {
    const signupBtn = document.querySelector('.btn-primary');
    if (signupBtn) signupBtn.onclick = handleSignUp;
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