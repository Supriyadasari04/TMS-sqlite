/**
 * populate-demo.js
 * Run this script locally to populate Supabase with demo data.
 * Usage: node backend/populate-demo.js
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

async function populate() {
    console.log('🚀 Starting demo data population...');

    const demoUsers = [
        {
            id: 'admin_demo',
            email: 'admin@smartdesk.com',
            username: 'HeadAdmin',
            password: await bcrypt.hash('password123', 10),
            role: 'admin',
            createdAt: new Date().toISOString()
        },
        {
            id: 'agent_demo',
            email: 'agent1@smartdesk.com',
            username: 'Agent_Alpha',
            password: await bcrypt.hash('password123', 10),
            role: 'agent',
            createdAt: new Date().toISOString()
        },
        {
            id: 'agent_demo2',
            email: 'agent2@smartdesk.com',
            username: 'SarahHelp',
            password: await bcrypt.hash('password123', 10),
            role: 'agent',
            createdAt: new Date().toISOString()
        },
        {
            id: 'agent_demo3',
            email: 'agent3@smartdesk.com',
            username: 'MikeTech',
            password: await bcrypt.hash('password123', 10),
            role: 'agent',
            createdAt: new Date().toISOString()
        },
        {
            id: 'demo-cust-1',
            email: 'customer1@smartdesk.com',
            username: 'Alex Johnson',
            password: await bcrypt.hash('password123', 10),
            role: 'customer',
            createdAt: new Date(Date.now() - 30 * 24 * 3600000).toISOString()
        },
        {
            id: 'demo-cust-2',
            email: 'customer2@smartdesk.com',
            username: 'Sarah Miller',
            password: await bcrypt.hash('password123', 10),
            role: 'customer',
            createdAt: new Date(Date.now() - 15 * 24 * 3600000).toISOString()
        }
    ];

    // 1. Clean and Insert Users
    console.log('Cleaning and inserting demo users...');
    for (const user of demoUsers) {
        // First delete to avoid any upsert/conflict issues
        await supabase.from('users').delete().eq('email', user.email);
        const { error } = await supabase.from('users').insert(user);
        if (error) console.error(`Error inserting user ${user.email}:`, error.message);
    }

    // Define some agents/admins we know exist
    const agent1 = 'agent_demo';
    const admin1 = 'admin_demo';

    const demoTickets = [
        {
            id: 'TCKT-DEMO-101',
            title: 'Unauthorized Transaction',
            description: 'I see a transaction of $500 that I did not authorize on my credit card. Please help!',
            impact: 'High',
            accountHolder: 'Alex Johnson',
            accountNumber: '1234567890',
            ifscCode: 'SDNK0001234',
            status: 'In Progress',
            createdBy: 'customer1@smartdesk.com',
            createdAt: new Date(Date.now() - 2 * 24 * 3600000).toISOString(),
            assignedTo: agent1,
            sentiment: 'frustrated',
            slaBreached: true
        },
        {
            id: 'TCKT-DEMO-102',
            title: 'Card Block / Lost Card',
            description: 'I lost my debit card while traveling. Need to block it immediately.',
            impact: 'High',
            accountHolder: 'Alex Johnson',
            accountNumber: '1234567890',
            ifscCode: 'SDNK0001234',
            status: 'Resolved',
            createdBy: 'customer1@smartdesk.com',
            createdAt: new Date(Date.now() - 5 * 24 * 3600000).toISOString(),
            assignedTo: agent1,
            sentiment: 'neutral',
            slaBreached: false,
            resolvedAt: new Date(Date.now() - 4.5 * 24 * 3600000).toISOString()
        },
        {
            id: 'TCKT-DEMO-103',
            title: 'Login Issue',
            description: 'Cannot log in to the portal after the last update. Keeps saying wrong password.',
            impact: 'Medium',
            accountHolder: 'Sarah Miller',
            accountNumber: '0987654321',
            ifscCode: 'SDNK0005678',
            status: 'Pending',
            createdBy: 'customer2@smartdesk.com',
            createdAt: new Date(Date.now() - 12 * 3600000).toISOString(),
            assignedTo: null,
            sentiment: 'angry',
            slaBreached: false
        },
        {
            id: 'TCKT-DEMO-104',
            title: 'Fund Transfer Issue',
            description: 'Transfer was successful from my side but recipient hasn\'t received it yet.',
            impact: 'Medium',
            accountHolder: 'Sarah Miller',
            accountNumber: '0987654321',
            ifscCode: 'SDNK0005678',
            status: 'Resolved',
            createdBy: 'customer2@smartdesk.com',
            createdAt: new Date(Date.now() - 10 * 24 * 3600000).toISOString(),
            assignedTo: admin1,
            sentiment: 'satisfied',
            slaBreached: false,
            resolvedAt: new Date(Date.now() - 9 * 24 * 3600000).toISOString()
        }
    ];

    // 2. Insert Tickets
    console.log('Inserting demo tickets...');
    for (const ticket of demoTickets) {
        const { error } = await supabase.from('tickets').upsert(ticket);
        if (error) console.error(`Error inserting ticket ${ticket.id}:`, error.message);
    }

    // 3. Insert Comments
    console.log('Inserting demo comments...');
    const comments = [
        {
            ticketId: 'TCKT-DEMO-101',
            userId: 'demo-cust-1',
            userRole: 'customer',
            userName: 'Alex Johnson',
            message: 'Hello, any updates on this?',
            createdAt: new Date(Date.now() - 1.5 * 24 * 3600000).toISOString()
        },
        {
            ticketId: 'TCKT-DEMO-101',
            userId: 'agent-id', // Placeholder
            userRole: 'agent',
            userName: 'agent_demo',
            message: 'We are investigating with the fraud department. Please wait.',
            createdAt: new Date(Date.now() - 1 * 24 * 3600000).toISOString()
        },
        {
            ticketId: 'TCKT-DEMO-104',
            userId: 'admin-id',
            userRole: 'admin',
            userName: 'admin_demo',
            message: 'The transaction has been cleared now.',
            createdAt: new Date(Date.now() - 9.1 * 24 * 3600000).toISOString()
        }
    ];
    await supabase.from('ticket_comments').insert(comments);

    // 4. Insert Feedback
    console.log('Inserting demo feedback...');
    const feedbacks = [
        {
            ticketId: 'TCKT-DEMO-102',
            customerEmail: 'customer1@smartdesk.com',
            customerName: 'Alex Johnson',
            rating: 5,
            comment: 'Very fast response. Thanks!',
            createdAt: new Date(Date.now() - 4 * 24 * 3600000).toISOString()
        },
        {
            ticketId: 'TCKT-DEMO-104',
            customerEmail: 'customer2@smartdesk.com',
            customerName: 'Sarah Miller',
            rating: 2,
            comment: 'Took too long to resolve my issue.',
            createdAt: new Date(Date.now() - 8 * 24 * 3600000).toISOString()
        }
    ];
    await supabase.from('feedback').insert(feedbacks);

    // 5. Insert Activity logs
    console.log('Inserting demo activity...');
    const activities = [
        {
            ticketId: 'TCKT-DEMO-101',
            action: 'ticket_created',
            performedBy: 'Alex Johnson',
            performedByRole: 'customer',
            details: 'Ticket opened via portal',
            createdAt: new Date(Date.now() - 2 * 24 * 3600000).toISOString()
        },
        {
            ticketId: 'TCKT-DEMO-101',
            action: 'status_changed',
            performedBy: 'agent_demo',
            performedByRole: 'agent',
            oldValue: 'Pending',
            newValue: 'In Progress',
            details: 'Agent picked up the ticket',
            createdAt: new Date(Date.now() - 1.8 * 24 * 3600000).toISOString()
        }
    ];
    await supabase.from('ticket_activity').insert(activities);

    console.log('✅ Demo data population complete!');
}

populate();
