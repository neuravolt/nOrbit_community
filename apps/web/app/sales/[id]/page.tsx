"use client";

import { useState, use } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "../../../src/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { FileText, Download, Play, CheckCircle, XCircle, FileSpreadsheet, ArrowRight, Send, RotateCcw, Edit3, Trash2, X, Eye, AlertTriangle, RefreshCw, ArrowLeft } from "lucide-react";
import { useAuthStore } from "../../../src/store/auth";

export default function QuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const id = resolvedParams.id;
  const queryClient = useQueryClient();
  const router = useRouter();
  
  const [timelineStatus, setTimelineStatus] = useState<string>("DRAFT");
  const [showRequestChangeModal, setShowRequestChangeModal] = useState(false);
  const [changeRequestText, setChangeRequestText] = useState("");
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role?.toUpperCase() === 'SUPER_ADMIN';

  // Fetch Quote Details
  const { data: quote, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['quote', id],
    queryFn: async () => {
      const { data } = await api.get(`/quotes/${id}`);
      return data;
    },
    retry: 1,
  });

  // Convert Quote to Invoice Mutation
  const convertToInvoiceMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/invoices/from-quote/${id}`);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['quote', id] });
      // Redirect directly to the invoice detail page
      if (data?.id) {
        window.location.href = `/billing/${data.id}`;
      } else {
        alert("Converted quote to invoice successfully!");
      }
    }
  });

  // Quote status updates mutations
  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      let endpoint = `/quotes/${id}/send`;
      if (status === 'ACCEPTED') endpoint = `/quotes/${id}/accept`;
      if (status === 'REJECTED') endpoint = `/quotes/${id}/reject`;
      const { data } = await api.patch(endpoint);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quote', id] });
    }
  });

  const rollbackQuoteMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.patch(`/quotes/${id}/rollback`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quote', id] });
      alert("Quotation reverted to DRAFT successfully.");
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || "Failed to revert quotation.");
    }
  });

  const resendQuoteMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/quotes/${id}/resend`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quote', id] });
      alert("Quotation email resent successfully.");
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || "Failed to resend quotation.");
    }
  });

  const deleteQuoteMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/quotes/${id}`);
    },
    onSuccess: () => {
      alert("Quotation deleted successfully.");
      router.push('/sales');
    },
    onError: (err: any) => {
      alert(err.response?.data?.message || "Failed to delete quotation.");
    }
  });

  const handleDownloadPdf = async () => {
    try {
      const resp = await api.get(`/quotes/${id}/pdf`, { responseType: 'blob' });
      const contentType = String(resp.headers['content-type'] ?? '');
      if (!contentType.includes('pdf')) {
        const text = await (resp.data as Blob).text();
        throw new Error(JSON.parse(text).message ?? 'PDF generation failed');
      }
      const url = URL.createObjectURL(new Blob([resp.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `quotation-${quote?.quoteNumber || id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(e.message ?? 'Failed to generate PDF');
    }
  };

  if (isLoading) return (
    <div className="p-8 flex items-center justify-center min-h-[400px]">
      <div className="text-center space-y-3">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-slate-500 text-sm">Loading quotation details...</p>
      </div>
    </div>
  );

  if (isError || !quote) {
    const errMsg = (error as any)?.response?.data?.message;
    const status = (error as any)?.response?.status;
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4 max-w-md">
          <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto">
            <AlertTriangle className="w-7 h-7 text-red-600" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">
            {status === 403 ? 'Access Denied' : status === 404 ? 'Quotation Not Found' : 'Failed to Load Quotation'}
          </h2>
          <p className="text-slate-500 text-sm">
            {status === 403
              ? 'You do not have permission to view this quotation.'
              : status === 404
              ? 'This quotation does not exist or may have been deleted.'
              : errMsg || 'Unable to load quotation. Please try again.'}
          </p>
          <div className="flex gap-3 justify-center">
            <Link href="/sales"><Button variant="outline" size="sm"><ArrowLeft className="w-4 h-4 mr-2" /> Back to Sales</Button></Link>
            {status !== 403 && status !== 404 && (
              <Button size="sm" onClick={() => refetch()}><RefreshCw className="w-4 h-4 mr-2" /> Retry</Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b pb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <FileText className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">{quote.quoteNumber}</h1>
            <Badge variant={quote.status === 'ACCEPTED' ? 'default' : quote.status === 'REJECTED' ? 'destructive' : 'secondary'}>
              {quote.status}
            </Badge>
          </div>
          <p className="text-slate-500">Title: <span className="font-semibold text-slate-700">{quote.title}</span></p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleDownloadPdf}>
            <Download className="w-4 h-4 mr-2" /> PDF Preview
          </Button>

          {(quote.status === 'DRAFT' || isSuperAdmin) ? (
            <Button 
              variant="outline" 
              onClick={() => {
                if (quote.status !== 'DRAFT') {
                  if (confirm("WARNING: Editing this quotation will reset the client's approval and require client to accept it again. Do you want to edit?")) {
                    router.push(`/sales?edit=${id}`);
                  }
                } else {
                  router.push(`/sales?edit=${id}`);
                }
              }}
            >
              <Edit3 className="w-4 h-4 mr-2" /> Edit Quote
            </Button>
          ) : (
            <Button 
              variant="outline" 
              className="text-indigo-700 border-indigo-200 hover:bg-indigo-50"
              onClick={() => setShowRequestChangeModal(true)}
            >
              <Send className="w-4 h-4 mr-2" /> Request Change
            </Button>
          )}

          {['DRAFT', 'REJECTED'].includes(quote.status) && (
            <Button
              variant="destructive"
              onClick={() => {
                if (confirm("Are you sure you want to delete this quotation?")) {
                  deleteQuoteMutation.mutate();
                }
              }}
              disabled={deleteQuoteMutation.isPending || updateStatusMutation.isPending || rollbackQuoteMutation.isPending}
            >
              <Trash2 className="w-4 h-4 mr-2" /> {deleteQuoteMutation.isPending ? "Deleting..." : "Delete Quote"}
            </Button>
          )}

          {quote.status !== 'DRAFT' && (
            <Button
              variant="outline"
              onClick={() => {
                if (confirm("Are you sure you want to resend this quotation via email?")) {
                  resendQuoteMutation.mutate();
                }
              }}
              disabled={resendQuoteMutation.isPending || updateStatusMutation.isPending || rollbackQuoteMutation.isPending}
            >
              <Send className="w-4 h-4 mr-2" /> {resendQuoteMutation.isPending ? "Sending..." : "Resend Email"}
            </Button>
          )}

          {quote.status !== 'DRAFT' && (
            <Button
              variant="outline"
              className="text-amber-700 border-amber-200 hover:bg-amber-50"
              onClick={() => {
                if (confirm("Are you sure you want to revert this quotation back to DRAFT? This will unlock editing and let you make changes.")) {
                  rollbackQuoteMutation.mutate();
                }
              }}
              disabled={rollbackQuoteMutation.isPending || updateStatusMutation.isPending || resendQuoteMutation.isPending}
            >
              <RotateCcw className="w-4 h-4 mr-2" /> Revert to Draft
            </Button>
          )}
          
          {quote.status === 'DRAFT' && (
            <Button
              onClick={() => updateStatusMutation.mutate('SENT')}
              className="bg-slate-900 text-white"
              disabled={updateStatusMutation.isPending || rollbackQuoteMutation.isPending || resendQuoteMutation.isPending}
            >
              <Play className="w-4 h-4 mr-2" /> Mark as Sent
            </Button>
          )}

          {quote.status === 'SENT' && (
            <>
              <Button
                onClick={() => updateStatusMutation.mutate('ACCEPTED')}
                className="bg-green-600 text-white hover:bg-green-700"
                disabled={updateStatusMutation.isPending || rollbackQuoteMutation.isPending || resendQuoteMutation.isPending}
              >
                <CheckCircle className="w-4 h-4 mr-2" /> Accept Quote
              </Button>
              <Button
                onClick={() => updateStatusMutation.mutate('REJECTED')}
                variant="destructive"
                disabled={updateStatusMutation.isPending || rollbackQuoteMutation.isPending || resendQuoteMutation.isPending}
              >
                <XCircle className="w-4 h-4 mr-2" /> Reject Quote
              </Button>
            </>
          )}

          {quote.status === 'ACCEPTED' && (
            quote.invoices && quote.invoices.length > 0 ? (
              <Button
                onClick={() => {
                  const inv = quote.invoices[0];
                  router.push(`/billing/${inv.id}`);
                }}
                className="bg-green-600 text-white hover:bg-green-700"
              >
                <Eye className="w-4 h-4 mr-2" /> View Existing Invoice
              </Button>
            ) : (
              <Button
                onClick={() => convertToInvoiceMutation.mutate()}
                className="bg-blue-600 text-white hover:bg-blue-700"
                disabled={convertToInvoiceMutation.isPending || rollbackQuoteMutation.isPending || resendQuoteMutation.isPending}
              >
                <ArrowRight className="w-4 h-4 mr-2" /> {convertToInvoiceMutation.isPending ? "Converting..." : "Convert to Invoice"}
              </Button>
            )
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        {/* Left Columns: Timeline, Description, Line Items */}
        <div className="md:col-span-2 space-y-8">
          {/* Timeline */}
          <Card>
            <CardHeader><CardTitle className="text-lg">Quotation Status Timeline</CardTitle></CardHeader>
            <CardContent>
              <div className="flex items-center justify-between max-w-xl mx-auto py-4">
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED'].includes(quote.status) ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-500"}`}>1</div>
                  <span className="text-xs font-semibold mt-1">Draft</span>
                </div>
                <div className="h-0.5 w-16 bg-slate-200 flex-1"></div>
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${['SENT', 'ACCEPTED', 'REJECTED'].includes(quote.status) ? "bg-blue-600 text-white" : "bg-slate-200 text-slate-500"}`}>2</div>
                  <span className="text-xs font-semibold mt-1">Sent</span>
                </div>
                <div className="h-0.5 w-16 bg-slate-200 flex-1"></div>
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${['ACCEPTED', 'REJECTED'].includes(quote.status) ? (quote.status === 'REJECTED' ? "bg-red-600 text-white" : "bg-green-600 text-white") : "bg-slate-200 text-slate-500"}`}>3</div>
                  <span className="text-xs font-semibold mt-1">{quote.status === 'REJECTED' ? "Rejected" : "Decision"}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-lg">Executive Summary</CardTitle></CardHeader>
            <CardContent>
              <p className="text-slate-700 text-sm whitespace-pre-line leading-relaxed">{quote.description || "No description provided."}</p>
            </CardContent>
          </Card>

          {/* Line items list */}
          <Card>
            <CardHeader><CardTitle className="text-lg font-semibold">Scope Deliverables</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Deliverable</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quote.lineItems?.map((item: any, idx: number) => (
                    <TableRow key={item.id || idx}>
                      <TableCell className="font-semibold text-slate-900">{item.description}</TableCell>
                      <TableCell className="text-right">{item.quantity} {item.unit}</TableCell>
                      <TableCell className="text-right">₹{item.unitPrice?.toLocaleString('en-IN')}</TableCell>
                      <TableCell className="text-right font-semibold">₹{item.amount?.toLocaleString('en-IN')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Quotation breakdown */}
          <Card>
            <CardHeader><CardTitle className="text-lg">Quotation Breakdown</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between text-sm text-slate-600">
                <span>Subtotal</span>
                <span>₹{quote.subTotal?.toLocaleString('en-IN')}</span>
              </div>
              {quote.discountAmount > 0 && (
                <div className="flex justify-between text-sm text-red-600">
                  <span>Discount</span>
                  <span>-₹{quote.discountAmount?.toLocaleString('en-IN')}</span>
                </div>
              )}
              <div className="flex justify-between text-sm text-slate-600">
                <span>Estimated GST ({quote.gstRate}%)</span>
                <span>₹{quote.gstAmount?.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-base font-bold text-slate-900 border-t pt-3">
                <span>Grand Total</span>
                <span>₹{quote.grandTotal?.toLocaleString('en-IN')}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Client info card */}
        <div className="space-y-8">
          <Card>
            <CardHeader><CardTitle className="text-sm font-semibold uppercase tracking-wider text-slate-400">Client Contact</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <span className="text-xs text-slate-400 block">Name</span>
                <span className="font-bold text-slate-800">{quote.client?.name}</span>
              </div>
              <div>
                <span className="text-xs text-slate-400 block">Email Address</span>
                <span className="text-sm text-slate-600">{quote.client?.email || 'No email registered'}</span>
              </div>
              <div>
                <span className="text-xs text-slate-400 block">Phone</span>
                <span className="text-sm text-slate-600">{quote.client?.phone || 'No phone registered'}</span>
              </div>
              {quote.validUntil && (
                <div className="border-t pt-4">
                  <span className="text-xs text-slate-400 block font-semibold">Valid Until</span>
                  <span className="text-sm text-amber-700 font-semibold">{new Date(quote.validUntil).toLocaleDateString()}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Request Change Modal */}
      {showRequestChangeModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-900">Request Change for Quotation</h3>
              <button 
                onClick={() => {
                  setShowRequestChangeModal(false);
                  setChangeRequestText('');
                }} 
                className="p-1 hover:bg-slate-100 rounded"
              >
                <X size={18} className="text-slate-500" />
              </button>
            </div>
            <p className="text-sm text-slate-500">
              Quotation <strong>{quote.quoteNumber}</strong> is already accepted or invoiced. Only Super Admins can edit it directly.
              Please describe the changes you want below:
            </p>
            <textarea
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm h-32 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Describe what needs to be changed..."
              value={changeRequestText}
              onChange={e => setChangeRequestText(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setShowRequestChangeModal(false);
                  setChangeRequestText('');
                }}
                className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!changeRequestText.trim()) {
                    alert('Please enter change details.');
                    return;
                  }
                  alert('Your change request has been submitted to the Super Admin successfully!');
                  setShowRequestChangeModal(false);
                  setChangeRequestText('');
                }}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Submit Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
