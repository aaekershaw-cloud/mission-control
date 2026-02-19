import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

let stripe: Stripe | null = null;

// Only initialize Stripe if the API key is available
if (process.env.STRIPE_SECRET_KEY) {
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2024-12-18.acacia',
  });
}

// Simple in-memory cache
let cache: {
  data: any;
  timestamp: number;
} | null = null;

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export async function GET(request: NextRequest) {
  try {
    // Return mock data if Stripe is not configured
    if (!stripe) {
      return NextResponse.json({
        error: 'Stripe not configured',
        mock: true,
        mrr: 2847.50,
        totalSubscribers: 47,
        planBreakdown: {
          'Starter': { count: 23, revenue: 575.0 },
          'Intermediate': { count: 18, revenue: 1440.0 },
          'Pro': { count: 6, revenue: 832.50 },
        },
        recentPayments: [
          { id: 'in_mock1', amount: 79.00, currency: 'usd', customer_email: 'user@example.com', created: Math.floor(Date.now() / 1000), description: 'Pro Plan' },
          { id: 'in_mock2', amount: 29.00, currency: 'usd', customer_email: 'customer@test.com', created: Math.floor(Date.now() / 1000) - 3600, description: 'Starter Plan' },
        ],
        revenueByDay: Array.from({ length: 30 }, (_, i) => ({
          date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          revenue: Math.random() * 500 + 50
        })),
        churnCount: 3,
        lastUpdated: new Date().toISOString(),
      });
    }

    // Check cache
    if (cache && (Date.now() - cache.timestamp) < CACHE_DURATION) {
      return NextResponse.json(cache.data);
    }

    // Fetch active subscriptions
    const subscriptions = await stripe.subscriptions.list({
      status: 'active',
      limit: 100,
    });

    // Fetch recent invoices (last 30 days)
    const thirtyDaysAgo = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);
    const invoices = await stripe.invoices.list({
      created: { gte: thirtyDaysAgo },
      status: 'paid',
      limit: 100,
    });

    // Fetch cancelled subscriptions for churn
    const cancelledSubscriptions = await stripe.subscriptions.list({
      status: 'canceled',
      created: { gte: thirtyDaysAgo },
      limit: 100,
    });

    // Process subscriptions for MRR and plan breakdown
    let mrr = 0;
    const planBreakdown: Record<string, { count: number; revenue: number }> = {};
    
    subscriptions.data.forEach(sub => {
      const monthlyAmount = sub.items.data.reduce((total, item) => {
        if (item.price.recurring?.interval === 'month') {
          return total + (item.price.unit_amount || 0) * item.quantity;
        } else if (item.price.recurring?.interval === 'year') {
          // Convert yearly to monthly
          return total + ((item.price.unit_amount || 0) * item.quantity) / 12;
        }
        return total;
      }, 0);

      mrr += monthlyAmount;

      // Group by plan name
      sub.items.data.forEach(item => {
        const planName = item.price.nickname || 
                        item.price.lookup_key || 
                        `${item.price.unit_amount} ${item.price.currency}`;
        
        if (!planBreakdown[planName]) {
          planBreakdown[planName] = { count: 0, revenue: 0 };
        }
        
        planBreakdown[planName].count += item.quantity;
        if (item.price.recurring?.interval === 'month') {
          planBreakdown[planName].revenue += (item.price.unit_amount || 0) * item.quantity;
        } else if (item.price.recurring?.interval === 'year') {
          planBreakdown[planName].revenue += ((item.price.unit_amount || 0) * item.quantity) / 12;
        }
      });
    });

    // Convert from cents to dollars
    mrr = mrr / 100;
    Object.keys(planBreakdown).forEach(plan => {
      planBreakdown[plan].revenue = planBreakdown[plan].revenue / 100;
    });

    // Total subscribers
    const totalSubscribers = subscriptions.data.length;

    // Recent payments
    const recentPayments = invoices.data.slice(0, 20).map(invoice => ({
      id: invoice.id,
      amount: (invoice.amount_paid || 0) / 100,
      currency: invoice.currency,
      customer_email: invoice.customer_email,
      created: invoice.created,
      description: invoice.lines.data[0]?.description || 'Payment',
    }));

    // Revenue by day (last 30 days)
    const revenueByDay: Record<string, number> = {};
    invoices.data.forEach(invoice => {
      const date = new Date(invoice.created * 1000).toISOString().split('T')[0];
      if (!revenueByDay[date]) {
        revenueByDay[date] = 0;
      }
      revenueByDay[date] += (invoice.amount_paid || 0) / 100;
    });

    // Fill in missing days with 0
    const today = new Date();
    for (let i = 0; i < 30; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      if (!revenueByDay[dateStr]) {
        revenueByDay[dateStr] = 0;
      }
    }

    // Convert to array and sort
    const revenueArray = Object.entries(revenueByDay)
      .map(([date, revenue]) => ({ date, revenue }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-30); // Last 30 days

    // Churn count
    const churnCount = cancelledSubscriptions.data.length;

    const dashboardData = {
      mrr: Math.round(mrr * 100) / 100,
      totalSubscribers,
      planBreakdown,
      recentPayments,
      revenueByDay: revenueArray,
      churnCount,
      lastUpdated: new Date().toISOString(),
    };

    // Update cache
    cache = {
      data: dashboardData,
      timestamp: Date.now(),
    };

    return NextResponse.json(dashboardData);
  } catch (error) {
    console.error('Stripe dashboard error:', error);
    
    // Return mock data if Stripe is not configured properly
    if (error instanceof Stripe.errors.StripeAuthenticationError) {
      return NextResponse.json({
        error: 'Stripe not configured',
        mock: true,
        mrr: 2847.50,
        totalSubscribers: 47,
        planBreakdown: {
          'Starter': { count: 23, revenue: 575.0 },
          'Intermediate': { count: 18, revenue: 1440.0 },
          'Pro': { count: 6, revenue: 832.50 },
        },
        recentPayments: [
          { id: 'in_mock1', amount: 79.00, currency: 'usd', customer_email: 'user@example.com', created: Math.floor(Date.now() / 1000), description: 'Pro Plan' },
          { id: 'in_mock2', amount: 29.00, currency: 'usd', customer_email: 'customer@test.com', created: Math.floor(Date.now() / 1000) - 3600, description: 'Starter Plan' },
        ],
        revenueByDay: Array.from({ length: 30 }, (_, i) => ({
          date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          revenue: Math.random() * 500 + 50
        })),
        churnCount: 3,
        lastUpdated: new Date().toISOString(),
      });
    }
    
    return NextResponse.json({ error: 'Failed to fetch Stripe data' }, { status: 500 });
  }
}