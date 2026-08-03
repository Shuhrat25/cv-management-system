import React, { useState } from 'react';
import { X, Send, Database, Cloud, FileText, CheckCircle, Copy } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../services/api';

interface IntegrationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  positionTitle?: string;
  apiToken?: string;
}

export const IntegrationsModal: React.FC<IntegrationsModalProps> = ({
  isOpen,
  onClose,
  positionTitle,
  apiToken,
}) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'salesforce' | 'powerautomate' | 'odoo'>('salesforce');

  // Salesforce state
  const [targetProduct, setTargetProduct] = useState('CV Matching Enterprise');
  const [sfNotes, setSfNotes] = useState('');
  const [sfResponse, setSfResponse] = useState<any>(null);
  const [isSfLoading, setIsSfLoading] = useState(false);

  // Power Automate state
  const [ticketSummary, setTicketSummary] = useState('');
  const [priority, setPriority] = useState<'High' | 'Average' | 'Low'>('Average');
  const [ticketResponse, setTicketResponse] = useState<any>(null);
  const [isTicketLoading, setIsTicketLoading] = useState(false);

  // Odoo state
  const [copiedToken, setCopiedToken] = useState(false);

  if (!isOpen) return null;

  const handleSalesforceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsSfLoading(true);
    try {
      const res = await apiRequest('/external/salesforce/create-contact', {
        method: 'POST',
        body: JSON.stringify({
          userId: user.id,
          targetProduct,
          additionalNotes: sfNotes,
        }),
      });
      setSfResponse(res);
    } catch (err: any) {
      alert(err.error || 'Failed to sync with Salesforce');
    } finally {
      setIsSfLoading(false);
    }
  };

  const handlePowerAutomateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setIsTicketLoading(true);
    try {
      const res = await apiRequest('/external/power-automate/create-ticket', {
        method: 'POST',
        body: JSON.stringify({
          reportedBy: user.name,
          userRole: user.role,
          positionTitle: positionTitle || 'General',
          pageLink: window.location.href,
          priority,
          summary: ticketSummary,
          adminEmail: 'admin@example.com',
        }),
      });
      setTicketResponse(res);
    } catch (err: any) {
      alert(err.error || 'Failed to generate ticket');
    } finally {
      setIsTicketLoading(false);
    }
  };

  const handleDownloadTicketJson = () => {
    if (!ticketResponse?.ticket) return;
    const blob = new Blob([JSON.stringify(ticketResponse.ticket, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Support_Ticket_${ticketResponse.ticket.TicketId}.json`;
    link.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 dark:text-slate-100 text-base">Enterprise Integrations Hub</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Salesforce, Power Automate & Odoo Connectors</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-slate-950/50 p-1">
          <button
            onClick={() => setActiveTab('salesforce')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'salesforce'
                ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Salesforce CRM
          </button>
          <button
            onClick={() => setActiveTab('powerautomate')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'powerautomate'
                ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Power Automate Ticket
          </button>
          <button
            onClick={() => setActiveTab('odoo')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'odoo'
                ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Odoo API Token
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto space-y-4">
          {/* Salesforce Tab */}
          {activeTab === 'salesforce' && (
            <div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mb-4">
                Sync current profile ({user?.name}) with Salesforce CRM to create a linked Account & Contact record via REST API.
              </p>

              {!sfResponse ? (
                <form onSubmit={handleSalesforceSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Target Product Line</label>
                    <input
                      type="text"
                      value={targetProduct}
                      onChange={(e) => setTargetProduct(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Additional Lead Notes</label>
                    <textarea
                      rows={3}
                      value={sfNotes}
                      onChange={(e) => setSfNotes(e.target.value)}
                      placeholder="Candidate interests, skills summary..."
                      className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSfLoading}
                    className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-500/25 transition-all"
                  >
                    {isSfLoading ? 'Syncing to Salesforce...' : 'Create Salesforce Account & Contact'}
                  </button>
                </form>
              ) : (
                <div className="space-y-3 bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-xl">
                  <div className="flex items-center space-x-2 text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                    <CheckCircle className="w-5 h-5" />
                    <span>{sfResponse.message}</span>
                  </div>
                  <pre className="text-[11px] bg-slate-900 text-emerald-300 p-3 rounded-lg overflow-x-auto font-mono">
                    {JSON.stringify(sfResponse.salesforceRecord, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* Power Automate Tab */}
          {activeTab === 'powerautomate' && (
            <div>
              <p className="text-xs text-slate-600 dark:text-slate-400 mb-4">
                Generate a support ticket JSON for OneDrive/Dropbox cloud flows to automatically trigger admin email notifications.
              </p>

              {!ticketResponse ? (
                <form onSubmit={handlePowerAutomateSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Priority</label>
                    <select
                      value={priority}
                      onChange={(e: any) => setPriority(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                    >
                      <option value="High">High</option>
                      <option value="Average">Average</option>
                      <option value="Low">Low</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Issue Summary</label>
                    <textarea
                      rows={3}
                      value={ticketSummary}
                      onChange={(e) => setTicketSummary(e.target.value)}
                      placeholder="Describe the issue or feature request..."
                      required
                      className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isTicketLoading}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-500/25 transition-all"
                  >
                    {isTicketLoading ? 'Generating Ticket JSON...' : 'Generate Support Ticket JSON'}
                  </button>
                </form>
              ) : (
                <div className="space-y-3 bg-indigo-500/10 border border-indigo-500/30 p-4 rounded-xl">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs text-indigo-600 dark:text-indigo-400">Power Automate Payload Ready</span>
                    <button
                      onClick={handleDownloadTicketJson}
                      className="flex items-center space-x-1 px-3 py-1 bg-indigo-600 text-white rounded-lg text-xs font-bold shadow hover:bg-indigo-700"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Download JSON</span>
                    </button>
                  </div>
                  <pre className="text-[11px] bg-slate-900 text-indigo-300 p-3 rounded-lg overflow-x-auto font-mono">
                    {JSON.stringify(ticketResponse.ticket, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* Odoo Tab */}
          {activeTab === 'odoo' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Odoo applications can consume aggregated results for positions using the unique inventory API token below.
              </p>
              <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Position API Token</span>
                <div className="flex items-center space-x-2">
                  <code className="flex-1 px-3 py-2 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-blue-600 dark:text-blue-400 font-mono overflow-x-auto">
                    {apiToken || 'SELECT_POSITION_TO_VIEW_TOKEN'}
                  </code>
                  {apiToken && (
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(apiToken);
                        setCopiedToken(true);
                        setTimeout(() => setCopiedToken(false), 2000);
                      }}
                      className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      {copiedToken ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </button>
                  )}
                </div>
                {apiToken && (
                  <p className="text-[11px] text-slate-500">
                    GET Endpoint:{' '}
                    <span className="font-mono text-slate-700 dark:text-slate-300">
                      /api/external/odoo/position-data/{apiToken}
                    </span>
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
