// scripts/signup.js
let isSubmitting = false; // Add this at the top

function resetButton() {
    isSubmitting = false;
    const submitButton = document.querySelector('.btn-primary');
    if (submitButton) {
        submitButton.disabled = false;
        submitButton.textContent = 'Create Account';
    }
}

function redirectToRole(role) {
    console.log("Executing redirect for role:", role);
    
    if (role === "admin") {
        window.location.href = "admin.html";
    } else if (role === "customer") {
        window.location.href = "customer.html";
    } else if (role === "agent") {
        window.location.href = "agent.html";
    } else {
        window.location.href = "signin.html";
    }
}

async function handleSignUp(event) {
    console.log("handleSignUp function started");
    
    if (event) {
        event.preventDefault();
        event.stopPropagation();
        console.log("Event prevented");
    }

    // Prevent double submission
    if (isSubmitting) {
        console.log("Already submitting, blocking...");
        return false;
    }

    isSubmitting = true;
    console.log("isSubmitting set to true");

    // Fix: Use class selector since your button doesn't have ID
    const submitButton = document.querySelector('.btn-primary');
    if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Creating Account...';
        console.log("Button disabled and text changed");
    }

    const email = document.getElementById("signup-email").value.trim();
    const username = document.getElementById("signup-username").value.trim();
    const password = document.getElementById("signup-password").value.trim();
    const confirm = document.getElementById("signup-confirm-password").value.trim();
    const role = document.getElementById("signup-role").value;

    console.log("Form values:", { email, username, role });

    if (!email || !username || !password || !confirm || !role) {
        alert("All fields are required");
        resetButton();
        return false;
    }

    if (password !== confirm) {
        alert("Passwords do not match");
        resetButton();
        return false;
    }

    try {
        console.log("Making API call to /api/signup...");
        
        const response = await fetch('http://localhost:3000/api/signup', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                email,
                username,
                password,
                role
            })
        });

        console.log("Response status:", response.status);
        
        const data = await response.json();
        console.log("Response data:", data);

        if (!response.ok) {
            throw new Error(data.error || 'Signup failed');
        }

        console.log("Signup successful!");
        console.log("Storing user in localStorage:", data.user);
        
        localStorage.setItem("currentUser", JSON.stringify(data.user));

        // Redirect immediately without alert
        console.log("Redirecting immediately to:", role);
        redirectToRole(role);
        
    } catch (error) {
        console.error('Signup error:', error);
        alert(error.message);
        resetButton();
    }
    
    return false;
}