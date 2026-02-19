'use client';

import { useState, useEffect } from 'react';
import { DollarSign, Users, TrendingUp, TrendingDown, Calendar, Mail, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';

interface StripeData {
  mrr: number;
  totalSubscribers: number;
  planBreakdown: Record<string, { count: number; revenue: number }>;
  recentPayments: Array<{
    id: string;
    amount: number;
    currency: string;
    customer_email: string;
    created: number;
    description: string;
  }>;
  revenueByDay: Array<{ date: string; revenue: number }>;
  churnCount: number;
  lastUpdated: string;
  mock?: boolean;
  error?: string;
}

export default function StripeDashboardPage() {
  const [data, setData] = useState<StripeData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/stripe-dashboard');
      if (res.ok) {
        const dashboardData = await res.json();
        setData(dashboardData);
        if (dashboardData.error) {
          setError(dashboardData.error);
        }
      } else {
        setError('Failed to fetch revenue data');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 mx-auto mb-4 animate-spin text-amber-400" />
          <p className="text-slate-400">Loading revenue data...</p>
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
            <TrendingDown className="w-8 h-8 text-red-400" />
          </div>
          <p className="text-red-400 mb-2">Failed to load revenue data</p>
          <p className="text-slate-500 text-sm">{error}</p>
          <button
            onClick={fetchData}
            className="mt-4 px-4 py-2 bg-amber-500 text-black rounded-lg font-medium hover:bg-amber-400 transition-all"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const maxRevenue = Math.max(...data.revenueByDay.map(d => d.revenue));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-white">💰 Revenue Dashboard</h1>
          {data.mock && (
            <span className="px-3 py-1 bg-yellow-500/20 border border-yellow-500/30 rounded-lg text-yellow-300 text-sm">
              Demo Data
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-400">
            Last updated: {format(new Date(data.lastUpdated), 'MMM d, h:mm a')}
          </span>
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* MRR */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-sm">Monthly Recurring Revenue</span>
            <DollarSign className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-white mb-1">
            ${data.mrr.toLocaleString()}
          </div>
          <div className="text-emerald-400 text-sm flex items-center gap-1">
            <TrendingUp className="w-4 h-4" />
            +12.3% from last month
          </div>
        </div>

        {/* Total Subscribers */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-sm">Total Subscribers</span>
            <Users className="w-5 h-5 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-white mb-1">
            {data.totalSubscribers.toLocaleString()}
          </div>
          <div className="text-blue-400 text-sm flex items-center gap-1">
            <TrendingUp className="w-4 h-4" />
            +8 this month
          </div>
        </div>

        {/* Churn */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-sm">Churn (30 days)</span>
            <TrendingDown className="w-5 h-5 text-red-400" />
          </div>
          <div className="text-2xl font-bold text-white mb-1">
            {data.churnCount}
          </div>
          <div className="text-slate-400 text-sm">
            {data.totalSubscribers > 0 
              ? `${((data.churnCount / data.totalSubscribers) * 100).toFixed(1)}% rate`
              : '0% rate'
            }
          </div>
        </div>

        {/* Average Revenue Per User */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 text-sm">ARPU</span>
            <DollarSign className="w-5 h-5 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-white mb-1">
            ${data.totalSubscribers > 0 
              ? (data.mrr / data.totalSubscribers).toFixed(0) 
              : '0'
            }
          </div>
          <div className="text-slate-400 text-sm">
            per subscriber/month
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Chart */}
        <div className="lg:col-span-2 bg-white/5 border border-white/10 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Revenue Trend (30 Days)</h3>
          <div className="space-y-2">
            {data.revenueByDay.slice(-7).map((day) => (
              <div key={day.date} className="flex items-center gap-3">
                <span className="text-xs text-slate-500 w-16 font-mono">
                  {format(new Date(day.date), 'MMM dd')}
                </span>
                <div className="flex-1 h-6 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500"
                    style={{
                      width: maxRevenue > 0 ? `${Math.max(5, (day.revenue / maxRevenue) * 100)}%` : '0%'
                    }}
                  />
                </div>
                <span className="text-sm text-white font-medium w-20 text-right">
                  ${day.revenue.toFixed(0)}
                </span>
              </div>
            ))}
          </div>
          
          <div className="mt-4 text-xs text-slate-500">
            Total last 7 days: ${data.revenueByDay.slice(-7).reduce((sum, day) => sum + day.revenue, 0).toFixed(2)}
          </div>
        </div>

        {/* Plan Breakdown */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Plan Breakdown</h3>
          <div className="space-y-4">
            {Object.entries(data.planBreakdown).map(([plan, stats]) => (
              <div key={plan}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-slate-300 font-medium">{plan}</span>
                  <span className="text-slate-400 text-sm">{stats.count} users</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden mr-3">
                    <div
                      className="h-full bg-gradient-to-r from-amber-500 to-orange-400 rounded-full"
                      style={{
                        width: data.totalSubscribers > 0 
                          ? `${(stats.count / data.totalSubscribers) * 100}%` 
                          : '0%'
                      }}
                    />
                  </div>
                  <span className="text-white font-medium">
                    ${stats.revenue.toFixed(0)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Recent Payments</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left text-slate-400 text-sm font-medium pb-3">Date</th>
                <th className="text-left text-slate-400 text-sm font-medium pb-3">Customer</th>
                <th className="text-left text-slate-400 text-sm font-medium pb-3">Description</th>
                <th className="text-right text-slate-400 text-sm font-medium pb-3">Amount</th>
              </tr>
            </thead>
            <tbody>
              {data.recentPayments.map((payment) => (
                <tr key={payment.id} className="border-b border-white/5 last:border-0">
                  <td className="py-3 text-slate-300 text-sm">
                    {format(new Date(payment.created * 1000), 'MMM d, h:mm a')}
                  </td>
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-slate-500" />
                      <span className="text-slate-300 text-sm">
                        {payment.customer_email || 'No email'}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 text-slate-300 text-sm">
                    {payment.description}
                  </td>
                  <td className="py-3 text-right font-medium text-emerald-400">
                    ${payment.amount.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}