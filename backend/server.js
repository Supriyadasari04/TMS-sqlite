// server.js
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cors = require('cors');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../')));

// Initialize SQLite Database
const db = new sqlite3.Database('./ticketpro.db', (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database.');
    initializeDatabase();
  }
});

// Initialize database tables
function initializeDatabase() {
  // Users table
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    username TEXT NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin', 'agent', 'customer')),
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    needsPasswordReset BOOLEAN DEFAULT FALSE
  )`);

  // Tickets table
  db.run(`CREATE TABLE IF NOT EXISTS tickets (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    impact TEXT NOT NULL CHECK(impact IN ('Low', 'Medium', 'High')),
    accountHolder TEXT NOT NULL,
    accountNumber TEXT NOT NULL,
    ifscCode TEXT NOT NULL,
    status TEXT DEFAULT 'Pending' CHECK(status IN ('Pending', 'In Progress', 'Resolved', 'Closed')),
    createdBy TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    assignedTo TEXT,
    FOREIGN KEY (createdBy) REFERENCES users(email),
    FOREIGN KEY (assignedTo) REFERENCES users(email)
  )`);

  // Notifications table
  db.run(`CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message TEXT NOT NULL,
    role TEXT,
    email TEXT,
    timestamp TEXT NOT NULL,
    read BOOLEAN DEFAULT FALSE
  )`);

  console.log('Database tables initialized');
}

// User Registration Endpoint
app.post('/api/signup', async (req, res) => {
  try {
    const { email, username, password, role } = req.body;

    // Validation
    if (!email || !username || !password || !role) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (!['admin', 'agent', 'customer'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    // Check if user already exists
    db.get('SELECT email FROM users WHERE email = ?', [email], async (err, row) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (row) {
        return res.status(400).json({ error: 'Email already exists' });
      }

      // Hash password (in production, always hash passwords!)
      // For now, we'll store as plaintext to match your current setup
      // const hashedPassword = await bcrypt.hash(password, 10);
      
      const newUser = {
        id: 'user_' + Date.now(),
        email,
        username,
        password: password, // In production: hashedPassword
        role,
        createdAt: new Date().toISOString(),
        needsPasswordReset: false
      };

      // Insert user into database
      db.run(
        `INSERT INTO users (id, email, username, password, role, createdAt, needsPasswordReset) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [newUser.id, newUser.email, newUser.username, newUser.password, newUser.role, newUser.createdAt, newUser.needsPasswordReset],
        function(err) {
          if (err) {
            return res.status(500).json({ error: 'Failed to create user' });
          }
          
          res.json({ 
            message: 'Account created successfully!',
            user: newUser
          });
        }
      );
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});


// Add these routes to your existing server.js

// User Login Endpoint
app.post('/api/signin', (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    // Find user by username and password
    db.get(
      'SELECT * FROM users WHERE username = ? AND password = ?',
      [username, password],
      (err, user) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }

        if (!user) {
          return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Check if using default password (you can customize this logic)
        const needsPasswordReset = (password === "Ticketpro@123");

        // Update needsPasswordReset if different from current value
        if (user.needsPasswordReset !== needsPasswordReset) {
          db.run(
            'UPDATE users SET needsPasswordReset = ? WHERE id = ?',
            [needsPasswordReset, user.id],
            (updateErr) => {
              if (updateErr) {
                console.error('Error updating password reset flag:', updateErr);
              }
            }
          );
        }

        // Return user data (excluding password in production)
        const userResponse = {
          id: user.id,
          email: user.email,
          username: user.username,
          role: user.role,
          createdAt: user.createdAt,
          needsPasswordReset: needsPasswordReset
        };

        res.json({
          message: 'Login successful',
          user: userResponse
        });
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user by ID (for session management)
app.get('/api/user/:id', (req, res) => {
  const userId = req.params.id;

  db.get(
    'SELECT id, email, username, role, createdAt, needsPasswordReset FROM users WHERE id = ?',
    [userId],
    (err, user) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json(user);
    }
  );
});

// Update user password (for password reset functionality)
// Update user password (for password reset functionality)
app.put('/api/user/:id/password', (req, res) => {
  const userId = req.params.id;
  const { newPassword, isPasswordReset = false } = req.body;

  // If it's a password reset (user forgot password or using default), skip current password verification
  if (isPasswordReset) {
    db.run(
      'UPDATE users SET password = ?, needsPasswordReset = ? WHERE id = ?',
      [newPassword, false, userId],
      function(updateErr) {
        if (updateErr) {
          return res.status(500).json({ error: 'Failed to update password' });
        }

        res.json({ message: 'Password updated successfully' });
      }
    );
  } else {
    // Regular password change - verify current password
    const { currentPassword } = req.body;
    
    // Verify current password first
    db.get(
      'SELECT * FROM users WHERE id = ? AND password = ?',
      [userId, currentPassword],
      (err, user) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }

        if (!user) {
          return res.status(401).json({ error: 'Current password is incorrect' });
        }

        // Update to new password
        db.run(
          'UPDATE users SET password = ?, needsPasswordReset = ? WHERE id = ?',
          [newPassword, false, userId],
          function(updateErr) {
            if (updateErr) {
              return res.status(500).json({ error: 'Failed to update password' });
            }

            res.json({ message: 'Password updated successfully' });
          }
        );
      }
    );
  }
});

// ===== ADMIN ENDPOINTS =====

// Get all tickets with filtering
app.get('/api/tickets', (req, res) => {
  const { searchField, searchValue } = req.query;
  
  let query = `
    SELECT t.*, u1.username as createdByName, u2.username as assignedToName 
    FROM tickets t 
    LEFT JOIN users u1 ON t.createdBy = u1.email 
    LEFT JOIN users u2 ON t.assignedTo = u2.email
  `;
  let params = [];

  if (searchField && searchValue) {
    query += ` WHERE t.${searchField} LIKE ?`;
    params.push(`%${searchValue}%`);
  }

  query += ' ORDER BY t.createdAt DESC';

  db.all(query, params, (err, tickets) => {
    if (err) {
      console.error('Error fetching tickets:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(tickets);
  });
});

// Get ticket statistics
app.get('/api/tickets/stats', (req, res) => {
  db.all(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'In Progress' THEN 1 ELSE 0 END) as inProgress,
      SUM(CASE WHEN status = 'Resolved' THEN 1 ELSE 0 END) as resolved
    FROM tickets
  `, (err, result) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(result[0]);
  });
});

// Assign agent to ticket
app.put('/api/tickets/:id/assign', (req, res) => {
  const ticketId = req.params.id;
  const { agentUsername, adminEmail } = req.body;

  db.run(
    'UPDATE tickets SET assignedTo = ?, status = ? WHERE id = ?',
    [agentUsername, agentUsername ? 'In Progress' : 'Pending', ticketId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to assign ticket' });
      }

      // Get ticket details for notification
      db.get('SELECT * FROM tickets WHERE id = ?', [ticketId], (err, ticket) => {
        if (ticket) {
          // Create notifications
          const timestamp = new Date().toLocaleString();
          
          // Notification for customer
          if (ticket.createdBy) {
            db.run(
              'INSERT INTO notifications (message, role, email, timestamp, read) VALUES (?, ?, ?, ?, ?)',
              [`Your ticket #${ticketId} has been assigned to agent ${agentUsername}.`, 'customer', ticket.createdBy, timestamp, false]
            );
          }

          // Notification for agent
          if (agentUsername) {
            db.get('SELECT email FROM users WHERE username = ?', [agentUsername], (err, agent) => {
              if (agent) {
                db.run(
                  'INSERT INTO notifications (message, role, email, timestamp, read) VALUES (?, ?, ?, ?, ?)',
                  [`You have been assigned to ticket #${ticketId} (${ticket.title}).`, 'agent', agent.email, timestamp, false]
                );
              }
            });
          }

          // Notification for admin
          db.run(
            'INSERT INTO notifications (message, role, timestamp, read) VALUES (?, ?, ?, ?)',
            [`Ticket #${ticketId} assigned to agent ${agentUsername}. Please monitor progress.`, 'admin', timestamp, false]
          );
        }

        res.json({ message: 'Ticket assigned successfully' });
      });
    }
  );
});

// Delete ticket
app.delete('/api/tickets/:id', (req, res) => {
  const ticketId = req.params.id;

  db.run('DELETE FROM tickets WHERE id = ?', [ticketId], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Failed to delete ticket' });
    }
    res.json({ message: 'Ticket deleted successfully' });
  });
});

// Get all users
app.get('/api/users', (req, res) => {
  db.all('SELECT id, email, username, role, createdAt, needsPasswordReset FROM users ORDER BY role', (err, users) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(users);
  });
});

// Create new user
app.post('/api/users', (req, res) => {
  const { username, email, role } = req.body;

  if (!username || !email || !role) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  // Check if user already exists
  db.get('SELECT * FROM users WHERE email = ? OR username = ?', [email, username], (err, existingUser) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (existingUser) {
      return res.status(400).json({ error: 'Username or email already exists' });
    }

    const newUser = {
      id: 'user_' + Date.now(),
      email,
      username,
      password: 'Ticketpro@123', // Default password
      role,
      createdAt: new Date().toISOString(),
      needsPasswordReset: true
    };

    db.run(
      'INSERT INTO users (id, email, username, password, role, createdAt, needsPasswordReset) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [newUser.id, newUser.email, newUser.username, newUser.password, newUser.role, newUser.createdAt, newUser.needsPasswordReset],
      function(err) {
        if (err) {
          return res.status(500).json({ error: 'Failed to create user' });
        }
        res.json({ message: 'User created successfully', user: newUser });
      }
    );
  });
});

// Delete user
app.delete('/api/users/:id', (req, res) => {
  const userId = req.params.id;

  // Prevent self-deletion
  db.get('SELECT email FROM users WHERE id = ?', [userId], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    // Check if user is trying to delete themselves (you'll need to pass current user info)
    const currentUserEmail = req.headers['x-user-email']; // You'll need to send this from frontend
    
    if (user && user.email === currentUserEmail) {
      return res.status(400).json({ error: 'You cannot delete your own account' });
    }

    db.run('DELETE FROM users WHERE id = ?', [userId], function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to delete user' });
      }
      res.json({ message: 'User deleted successfully' });
    });
  });
});

// Get notifications for user
app.get('/api/notifications', (req, res) => {
  const { email, role } = req.query;

  let query = 'SELECT * FROM notifications WHERE read = 0 AND (email = ? OR role = ?) ORDER BY timestamp DESC';
  
  db.all(query, [email, role], (err, notifications) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(notifications);
  });
});

// Mark notification as read
app.put('/api/notifications/:id/read', (req, res) => {
  const notificationId = req.params.id;

  db.run('UPDATE notifications SET read = 1 WHERE id = ?', [notificationId], function(err) {
    if (err) {
      return res.status(500).json({ error: 'Failed to mark notification as read' });
    }
    res.json({ message: 'Notification marked as read' });
  });
});

// Mark all notifications as read for user
app.put('/api/notifications/read-all', (req, res) => {
  const { email, role } = req.body;

  db.run(
    'UPDATE notifications SET read = 1 WHERE (email = ? OR role = ?) AND read = 0',
    [email, role],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to mark notifications as read' });
      }
      res.json({ message: 'All notifications marked as read' });
    }
  );
});

// ===== AGENT ENDPOINTS =====

// Get agent's ticket statistics
app.get('/api/agent/stats', (req, res) => {
  const { agentUsername } = req.query;

  db.all(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'In Progress' THEN 1 ELSE 0 END) as inProgress,
      SUM(CASE WHEN status = 'Resolved' THEN 1 ELSE 0 END) as resolved
    FROM tickets 
    WHERE assignedTo = ?
  `, [agentUsername], (err, result) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(result[0]);
  });
});

// Get agent's tickets with filtering
app.get('/api/agent/tickets', (req, res) => {
  const { agentUsername, status, search } = req.query;
  
  let query = `
    SELECT t.*, u1.username as createdByName
    FROM tickets t 
    LEFT JOIN users u1 ON t.createdBy = u1.email 
    WHERE t.assignedTo = ?
  `;
  let params = [agentUsername];

  if (status && status !== 'all') {
    query += ' AND t.status = ?';
    params.push(status);
  }

  if (search) {
    query += ` AND (
      t.title LIKE ? OR 
      t.accountHolder LIKE ? OR 
      t.id LIKE ? OR
      t.description LIKE ?
    )`;
    const searchParam = `%${search}%`;
    params.push(searchParam, searchParam, searchParam, searchParam);
  }

  query += ' ORDER BY t.createdAt DESC';

  db.all(query, params, (err, tickets) => {
    if (err) {
      console.error('Error fetching agent tickets:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(tickets);
  });
});

// Update ticket status (agent)
app.put('/api/tickets/:id/status', (req, res) => {
  const ticketId = req.params.id;
  const { status, agentUsername } = req.body;

  db.run(
    'UPDATE tickets SET status = ? WHERE id = ? AND assignedTo = ?',
    [status, ticketId, agentUsername],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Failed to update ticket status' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'Ticket not found or not assigned to you' });
      }

      // Get ticket details for notification
      db.get('SELECT * FROM tickets WHERE id = ?', [ticketId], (err, ticket) => {
        if (ticket) {
          const timestamp = new Date().toLocaleString();
          
          // Notification for customer
          if (ticket.createdBy) {
            db.run(
              'INSERT INTO notifications (message, role, email, timestamp, read) VALUES (?, ?, ?, ?, ?)',
              [`Status of your ticket #${ticketId} has been changed to "${status}".`, 'customer', ticket.createdBy, timestamp, false]
            );
          }

          // Notification for admin
          db.run(
            'INSERT INTO notifications (message, role, timestamp, read) VALUES (?, ?, ?, ?)',
            [`Ticket #${ticketId} status changed to "${status}" by ${agentUsername}.`, 'admin', timestamp, false]
          );
        }

        res.json({ message: 'Ticket status updated successfully' });
      });
    }
  );
});

// ===== CUSTOMER ENDPOINTS =====

// Get customer's ticket statistics
app.get('/api/customer/stats', (req, res) => {
  const { customerEmail } = req.query;

  db.all(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'In Progress' THEN 1 ELSE 0 END) as inProgress,
      SUM(CASE WHEN status = 'Resolved' THEN 1 ELSE 0 END) as resolved
    FROM tickets 
    WHERE createdBy = ?
  `, [customerEmail], (err, result) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(result[0]);
  });
});

// Get customer's tickets
app.get('/api/customer/tickets', (req, res) => {
  const { customerEmail } = req.query;
  
  const query = `
    SELECT t.*, u.username as assignedToName
    FROM tickets t 
    LEFT JOIN users u ON t.assignedTo = u.username
    WHERE t.createdBy = ?
    ORDER BY t.createdAt DESC
  `;

  db.all(query, [customerEmail], (err, tickets) => {
    if (err) {
      console.error('Error fetching customer tickets:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(tickets);
  });
});

// Create new ticket
app.post('/api/tickets', (req, res) => {
  const { 
    title, 
    description, 
    impact, 
    accountHolder, 
    accountNumber, 
    ifscCode, 
    createdBy 
  } = req.body;

  // Validate required fields
  if (!title || !description || !impact || !accountHolder || !accountNumber || !ifscCode || !createdBy) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  const newTicket = {
    id: "TCKT-" + Date.now(),
    title,
    description,
    impact,
    accountHolder,
    accountNumber,
    ifscCode,
    status: "Pending",
    createdBy,
    createdAt: new Date().toLocaleString(),
    assignedTo: null
  };

  // Insert ticket into database
  db.run(
    `INSERT INTO tickets (id, title, description, impact, accountHolder, accountNumber, ifscCode, status, createdBy, createdAt, assignedTo) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      newTicket.id, 
      newTicket.title, 
      newTicket.description, 
      newTicket.impact, 
      newTicket.accountHolder, 
      newTicket.accountNumber, 
      newTicket.ifscCode, 
      newTicket.status, 
      newTicket.createdBy, 
      newTicket.createdAt, 
      newTicket.assignedTo
    ],
    function(err) {
      if (err) {
        console.error('Error creating ticket:', err);
        return res.status(500).json({ error: 'Failed to create ticket' });
      }

      // Get user details for notifications
      db.get('SELECT username FROM users WHERE email = ?', [createdBy], (err, user) => {
        const timestamp = new Date().toLocaleString();
        
        // Notification for admin
        db.run(
          'INSERT INTO notifications (message, role, timestamp, read) VALUES (?, ?, ?, ?)',
          [`New ticket created by ${createdBy}: #${newTicket.id}`, 'admin', timestamp, false]
        );

        // Notification for customer
        db.run(
          'INSERT INTO notifications (message, role, email, timestamp, read) VALUES (?, ?, ?, ?, ?)',
          [`Your ticket #${newTicket.id} has been created successfully. Our team will reach out soon.`, 'customer', createdBy, timestamp, false]
        );

        res.json({ 
          message: 'Ticket created successfully!',
          ticket: newTicket
        });
      });
    }
  );
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});