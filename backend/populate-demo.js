/**
 * populate-demo.js
 * Comprehensive Demo Reset Script
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

async function wipeAndPopulate() {
    console.log('🗑️ Wiping existing data...');
    const tables = ['feedback', 'ticket_activity', 'ticket_comments', 'attachments', 'tickets', 'users'];
    for (const table of tables) {
        const { error } = await supabase.from(table).delete().neq('id', '0'); // Basic wipe
        if (error) console.log(`Note: Initial wipe of ${table} had entries or was already empty.`);
    }

    console.log('🚀 Creating 15 professional accounts...');
    const password = await bcrypt.hash('password123', 10);
    
    const users = [
        // 1 Admin
        { id: 'admin-1', email: 'admin@smartdesk.com', username: 'Head Admin', password, role: 'admin' },
        // 4 Agents
        { id: 'agent-1', email: 'agent1@smartdesk.com', username: 'Sarah Thompson', password, role: 'agent' },
        { id: 'agent-2', email: 'agent2@smartdesk.com', username: 'Michael Chen', password, role: 'agent' },
        { id: 'agent-3', email: 'agent3@smartdesk.com', username: 'Emily Davis', password, role: 'agent' },
        { id: 'agent-4', email: 'agent4@smartdesk.com', username: 'Marcus Reed', password, role: 'agent' },
    ];

    // 10 Customers
    for (let i = 1; i <= 10; i++) {
        users.push({
            id: `cust-${i}`,
            email: `customer${i}@smartdesk.com`,
            username: `Customer ${i}`,
            password,
            role: 'customer'
        });
    }

    const { error: userErr } = await supabase.from('users').insert(users);
    if (userErr) console.error('User Insert Error:', userErr);

    console.log('🎫 Generating diverse ticket history...');
    const now = new Date();
    
    // Create 15 tickets with different states
    const tickets = [];
    const statuses = ['Pending', 'In Progress', 'Resolved', 'Resolved', 'In Progress', 'Pending'];
    const impacts = ['High', 'Medium', 'Low'];

    for (let i = 1; i <= 15; i++) {
        const status = statuses[i % statuses.length];
        const impact = impacts[i % impacts.length];
        const creator = users[5 + (i % 10)].email;
        const agent = (i % 2 === 0) ? users[1 + (i % 4)].username : null;
        
        tickets.push({
            id: `TCKT-2026-${100 + i}`,
            title: `Enterprise Issue #${i}: ${['Login problem', 'Data Export', 'Account Lockdown', 'Billing Query'][i % 4]}`,
            description: `This is a high-priority demonstration ticket for ${status} state testing.`,
            impact: impact,
            accountHolder: `Demo User ${i}`,
            accountNumber: `60007000${i}`,
            ifscCode: 'SDNK0001234',
            status: status,
            createdBy: creator,
            assignedTo: agent,
            createdAt: new Date(now.getTime() - i * 24 * 3600000).toISOString(),
            slaBreached: i % 5 === 0,
            resolvedAt: status === 'Resolved' ? now.toISOString() : null
        });
    }

    const { error: ticketErr } = await supabase.from('tickets').insert(tickets);
    if (ticketErr) console.error('Ticket Insert Error:', ticketErr);

    console.log('💬 Adding chat history and feedback...');
    // Add comments to some tickets
    const comments = [
        { ticketId: 'TCKT-2026-104', userId: 'agent-1', userRole: 'agent', userName: 'Sarah Thompson', message: 'I have started looking into your account lockdown issue.', createdAt: new Date(now.getTime() - 12 * 3600000).toISOString() },
        { ticketId: 'TCKT-2026-104', userId: 'cust-1', userRole: 'customer', userName: 'Customer 1', message: 'Thank you, I need this resolved for my meeting today.', createdAt: new Date(now.getTime() - 11 * 3600000).toISOString() }
    ];
    await supabase.from('ticket_comments').insert(comments);

    // Add feedback for resolved tickets
    const feedbacks = [
        { ticketId: 'TCKT-2026-103', customerEmail: 'customer8@smartdesk.com', customerName: 'Customer 8', rating: 5, comment: 'Excellent and fast service!', createdAt: now.toISOString() },
        { ticketId: 'TCKT-2026-109', customerEmail: 'customer4@smartdesk.com', customerName: 'Customer 4', rating: 2, comment: 'Took too long to respond.', createdAt: now.toISOString() }
    ];
    await supabase.from('feedback').insert(feedbacks);

    console.log('✅ DATABASE RESET & DEMO DATA COMPLETE!');
}

wipeAndPopulate();
