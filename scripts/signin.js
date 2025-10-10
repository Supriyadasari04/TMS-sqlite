function handleSignIn(event) {
  if (event) event.preventDefault();

  const username = document.getElementById("signin-username").value.trim();
  const password = document.getElementById("signin-password").value.trim();

  const users = JSON.parse(localStorage.getItem("users")) || [];
  const user = users.find(u => u.username === username && u.password === password);

  if (!user) {
    alert("Invalid credentials!");
    return;
  }

  // Mark if the user is using default password
  if (password === "Ticketpro@123") {
    user.needsPasswordReset = true;
  } else {
    user.needsPasswordReset = false;
  }

  // Update localStorage with possibly updated user info
  const updatedUsers = users.map(u => (u.email === user.email ? user : u));
  localStorage.setItem("users", JSON.stringify(updatedUsers));

  // Store current user
  localStorage.setItem("currentUser", JSON.stringify(user));

  // Redirect by role
  if (user.role === "admin") {
    window.location.href = "/Ticket-Management-System/html/admin.html";
  } else if (user.role === "customer") {
    window.location.href = "/Ticket-Management-System/html/customer.html";
  } else if (user.role === "agent") {
    window.location.href = "/Ticket-Management-System/html/agent.html";
  } else {
    alert("No dashboard available for this role.");
  }
}
