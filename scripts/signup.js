function handleSignUp(event) {
  if (event) event.preventDefault();

  const email = document.getElementById("signup-email").value.trim();
  const username = document.getElementById("signup-username").value.trim();
  const password = document.getElementById("signup-password").value.trim();
  const confirm = document.getElementById("signup-confirm-password").value.trim();
  const role = document.getElementById("signup-role").value;

  if (!email || !username || !password || !confirm || !role) {
    alert("All fields are required");
    return;
  }

  if (password !== confirm) {
    alert("Passwords do not match");
    return;
  }

  const users = JSON.parse(localStorage.getItem("users")) || [];

  if (users.find(u => u.email === email)) {
    alert("Email already exists");
    return;
  }

  const newUser = {
    id: "user_" + Date.now(),
    email,
    username,
    password,
    role,
    createdAt: new Date().toISOString(),
  };

  users.push(newUser);
  localStorage.setItem("users", JSON.stringify(users));
 localStorage.setItem("currentUser", JSON.stringify(newUser));

  alert("Account created successfully!");

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