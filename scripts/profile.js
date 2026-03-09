/* ============================================
   Profile Page Script – SmartDesk
   ============================================ */

window.onload = async function () {
    const currentUser = getCurrentUser();
    if (!currentUser) {
        window.location.href = '../html/signin.html';
        return;
    }

    // Sidebar Updates
    document.getElementById('display-username').innerText = currentUser.username;
    if (document.getElementById('side-avatar')) {
        document.getElementById('side-avatar').innerText = currentUser.username.charAt(0).toUpperCase();
        document.getElementById('admin-name-side').innerText = currentUser.username;
    }

    // Profile Details
    document.getElementById('prof-username').innerText = currentUser.username;
    document.getElementById('prof-email').innerText = currentUser.email;
    document.getElementById('prof-role').innerText = currentUser.role.toUpperCase();
    document.getElementById('prof-id').innerText = currentUser.id;

    // Fetch extra details if not in local storage
    try {
        const response = await authFetch(`/api/user/${currentUser.id}`);
        const fullUser = await response.json();
        if (response.ok) {
            document.getElementById('prof-joined').innerText = new Date(fullUser.createdAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        }
    } catch (error) {
        console.error('Error fetching full profile:', error);
        document.getElementById('prof-joined').innerText = 'N/A';
    }

    // Redirect for Dashboard link in sidebar
    const dashLink = document.getElementById('dash-link');
    if (dashLink) {
        dashLink.onclick = (e) => {
            e.preventDefault();
            redirectToDashboard(currentUser.role);
        };
    }
};



async function deleteAccount() {
    const currentUser = getCurrentUser();
    if (!currentUser) return;

    const confirmMessage = `⚠️ CRITICAL: deleting your account will permanently remove all your tickets and history.\n\nType DELETE to confirm:`;
    const input = prompt(confirmMessage);

    if (input !== 'DELETE') {
        alert('Deletion cancelled.');
        return;
    }

    try {
        const response = await authFetch(`/api/users/${currentUser.id}`, {
            method: 'DELETE',
            headers: { 'x-user-email': currentUser.email /* Required by server constraint */ }
        });

        const data = await response.json();
        if (response.ok) {
            alert('Your account and all associated data have been permanently deleted.');
            logout();
        } else {
            throw new Error(data.error || 'Failed to delete account');
        }
    } catch (error) {
        console.error('Account Deletion Error:', error);
        alert('Error: ' + error.message);
    }
}

function redirectToDashboard(role) {
    if (role === 'admin') window.location.href = 'admin.html';
    else if (role === 'agent') window.location.href = 'agent.html';
    else window.location.href = 'customer.html';
}
