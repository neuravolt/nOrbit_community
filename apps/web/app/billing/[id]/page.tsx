"use client";

import { useState, use } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../src/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../../components/ui/select";
import { FileText, Download, CreditCard, DollarSign, History, AlertCircle, Mail, Send, CheckCircle2, Copy, Check, RefreshCw, MailCheck } from "lucide-react";

export default function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const id = resolvedParams.id;
  const queryClient = useQueryClient();
  
  // Record payment form fields
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("BANK_TRANSFER");
  const [payTxId, setPayTxId] = useState("");
  const [payNotes, setPayNotes] = useState("");

  // Fetch Invoice Details
  const { data: invoice, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['invoice', id],
    queryFn: async () => {
      const { data } = await api.get(`/invoices/${id}`);
      return data;
    }
  });

  // Record Payment Mutation
  const recordPaymentMutation = useMutation({
    mutationFn: async (payload: any) => {
      const { data } = await api.patch(`/invoices/${id}/record-payment`, payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice', id] });
      setPayAmount("");
      setPayTxId("");
      setPayNotes("");
    }
  });

  // Delivery proof query & resend mutation
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  const { data: deliveryData, refetch: refetchDeliveries, isLoading: isDeliveriesLoading } = useQuery({
    queryKey: ['invoice-deliveries', id],
    queryFn: async () => {
      const { data } = await api.get(`/mailbox/invoices/${id}/delivery`);
      return data;
    }
  });

  const resendMutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post(`/mailbox/invoices/${id}/resend`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice', id] });
      queryClient.invalidateQueries({ queryKey: ['invoice-deliveries', id] });
      setResendMessage("Invoice email dispatched successfully! PDF attached and SMTP log recorded.");
      setTimeout(() => setResendMessage(null), 6000);
    },
    onError: (err: any) => {
      alert(err?.response?.data?.message || err?.message || "Failed to resend email");
    }
  });

  const copyToClipboard = (text: string, itemId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(itemId);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleRecordPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!payAmount) return;
    recordPaymentMutation.mutate({
      amount: Number(payAmount),
      method: payMethod,
      transactionId: payTxId,
      notes: payNotes,
    });
  };

  const handleDownloadPdf = async () => {
    try {
      const resp = await api.get(`/invoices/${id}/pdf`, { responseType: 'blob' });
      const contentType = String(resp.headers['content-type'] ?? '');
      if (!contentType.includes('pdf')) {
        const text = await (resp.data as Blob).text();
        throw new Error(JSON.parse(text).message ?? 'PDF generation failed');
      }
      const url = URL.createObjectURL(new Blob([resp.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${invoice?.invoiceNumber || id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(e.message ?? 'Failed to generate PDF');
    }
  };

  if (isLoading) return <div className="p-8">Loading invoice details...</div>;
  if (isError || !invoice) {
    return (
      <div className="p-8 space-y-3">
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm">
          Failed to load this invoice. {(error as any)?.response?.data?.message || (error as any)?.message || "Please try again."}
        </div>
        <Button onClick={() => refetch()}>Retry</Button>
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
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">{invoice.invoiceNumber}</h1>
            <Badge variant={invoice.status === 'paid' ? 'default' : invoice.status === 'overdue' ? 'destructive' : 'secondary'}>
              {invoice.status}
            </Badge>
          </div>
          <p className="text-slate-500">Project: <span className="font-semibold text-slate-700">{invoice.project?.name || 'General Consulting'}</span></p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => {
              if (confirm(`Resend invoice ${invoice.invoiceNumber} to ${invoice.client?.email || 'client'}?`)) {
                resendMutation.mutate();
              }
            }}
            disabled={resendMutation.isPending}
            variant="outline"
            className="border-indigo-200 text-indigo-700 hover:bg-indigo-50"
          >
            {resendMutation.isPending ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin text-indigo-600" />
            ) : (
              <Send className="w-4 h-4 mr-2 text-indigo-600" />
            )}
            {resendMutation.isPending ? "Sending Email..." : "Resend Invoice Email"}
          </Button>
          <Button onClick={handleDownloadPdf} className="bg-blue-600 text-white hover:bg-blue-700">
            <Download className="w-4 h-4 mr-2" /> Download Invoice PDF
          </Button>
        </div>
      </div>

      {resendMessage && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg p-4 flex items-center justify-between text-sm shadow-sm animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span className="font-medium">{resendMessage}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setResendMessage(null)} className="text-emerald-700 hover:bg-emerald-100">Dismiss</Button>
        </div>
      )}

      <div className="grid md:grid-cols-3 gap-8">
        {/* Left Columns: Invoice summary & Line items */}
        <div className="md:col-span-2 space-y-8">
          <Card>
            <CardHeader><CardTitle className="text-lg">Billing Details</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-6 text-sm">
              <div>
                <span className="text-slate-400 block font-semibold text-[10px] uppercase">Client Name</span>
                <span className="font-semibold text-slate-800">{invoice.client?.name}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold text-[10px] uppercase">Client GSTIN</span>
                <span className="font-mono text-slate-600">{invoice.client?.gstNumber || '—'}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold text-[10px] uppercase">Issue Date</span>
                <span>{invoice.issueDate}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-semibold text-[10px] uppercase">Due Date</span>
                <span className="font-semibold text-slate-800">{invoice.dueDate}</span>
              </div>
              {invoice.asset && (
                <div>
                  <span className="text-slate-400 block font-semibold text-[10px] uppercase">Linked Asset</span>
                  <span className="font-semibold text-slate-800">{invoice.asset.name}</span>
                </div>
              )}
              {invoice.amcContract && (
                <div>
                  <span className="text-slate-400 block font-semibold text-[10px] uppercase">Linked AMC Contract</span>
                  <Link href={`/amc/${invoice.amcContract.id}`} className="font-mono text-indigo-700 hover:underline">
                    {invoice.amcContract.contractNumber}
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Line items list */}
          <Card>
            <CardHeader><CardTitle className="text-lg">Line Items</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead>HSN</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoice.lineItems?.map((item: any, idx: number) => (
                    <TableRow key={item.id || idx}>
                      <TableCell className="font-semibold text-slate-900">
                        {item.description}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-slate-500">{item.hsnCode || '—'}</TableCell>
                      <TableCell className="text-right">{item.quantity} {item.unit}</TableCell>
                      <TableCell className="text-right">₹{item.unitPrice?.toLocaleString('en-IN')}</TableCell>
                      <TableCell className="text-right font-semibold">₹{item.amount?.toLocaleString('en-IN')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* GST breakdown table */}
          <Card>
            <CardHeader><CardTitle className="text-lg">Invoice Breakdown</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between text-sm text-slate-600">
                <span>Subtotal</span>
                <span>₹{invoice.subTotal?.toLocaleString('en-IN')}</span>
              </div>
              {invoice.discountAmount > 0 && (
                <div className="flex justify-between text-sm text-red-600">
                  <span>Discount</span>
                  <span>-₹{invoice.discountAmount?.toLocaleString('en-IN')}</span>
                </div>
              )}
              
              {invoice.gstType === 'CGST_SGST' ? (
                <>
                  <div className="flex justify-between text-sm text-slate-600">
                    <span>CGST @ {invoice.cgstRate}%</span>
                    <span>₹{invoice.cgstAmount?.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between text-sm text-slate-600">
                    <span>SGST @ {invoice.sgstRate}%</span>
                    <span>₹{invoice.sgstAmount?.toLocaleString('en-IN')}</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between text-sm text-slate-600">
                  <span>IGST @ {invoice.igstRate}%</span>
                  <span>₹{invoice.igstAmount?.toLocaleString('en-IN')}</span>
                </div>
              )}

              <div className="flex justify-between text-base font-bold text-slate-900 border-t pt-3">
                <span>Grand Total</span>
                <span>₹{invoice.grandTotal?.toLocaleString('en-IN')}</span>
              </div>
            </CardContent>
          </Card>

          {/* Payment History */}
          <Card>
            <CardHeader><CardTitle className="text-lg flex items-center gap-2"><History className="w-5 h-5 text-slate-500" /> Payment History</CardTitle></CardHeader>
            <CardContent>
              {invoice.payments?.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Method</TableHead>
                      <TableHead>Transaction ID</TableHead>
                      <TableHead className="text-right">Amount Paid</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoice.payments.map((p: any) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-semibold text-xs">{p.method}</TableCell>
                        <TableCell className="font-mono text-xs text-slate-600">{p.transactionId || '—'}</TableCell>
                        <TableCell className="text-right font-bold text-green-600">₹{p.amount?.toLocaleString('en-IN')}</TableCell>
                        <TableCell className="text-xs text-slate-400">{new Date(p.paidAt).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-slate-500 text-sm">No payments recorded yet.</p>
              )}
            </CardContent>
          </Card>

          {/* Email Delivery Proof & Dispatch History */}
          <Card className="border-indigo-100 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <MailCheck className="w-5 h-5 text-indigo-600" />
                  Email Delivery Proof & Dispatch History
                </CardTitle>
                <p className="text-xs text-slate-500 mt-1">
                  Cryptographic SMTP message IDs and exact timestamps proving invoice delivery to client
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => refetchDeliveries()}
                className="text-slate-500 hover:text-indigo-600"
                title="Refresh dispatch logs"
              >
                <RefreshCw className={`w-4 h-4 ${isDeliveriesLoading ? 'animate-spin text-indigo-600' : ''}`} />
              </Button>
            </CardHeader>
            <CardContent>
              {deliveryData?.deliveries?.length ? (
                <div className="space-y-3">
                  <div className="overflow-x-auto rounded-lg border border-slate-100">
                    <Table>
                      <TableHeader className="bg-slate-50">
                        <TableRow>
                          <TableHead className="text-xs">Status</TableHead>
                          <TableHead className="text-xs">Dispatch Date & Time</TableHead>
                          <TableHead className="text-xs">Recipient Email</TableHead>
                          <TableHead className="text-xs">SMTP Message ID (Proof)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {deliveryData.deliveries.map((item: any) => (
                          <TableRow key={item.id} className="hover:bg-slate-50/60">
                            <TableCell>
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                Delivered
                              </span>
                            </TableCell>
                            <TableCell className="text-xs font-medium text-slate-700 whitespace-nowrap">
                              {new Date(item.createdAt).toLocaleString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                                hour12: true,
                              })}
                            </TableCell>
                            <TableCell className="text-xs font-semibold text-slate-800">
                              {item.recipientEmail}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-1.5">
                                <code className="font-mono text-[11px] text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 max-w-[260px] truncate" title={item.smtpMessageId}>
                                  {item.smtpMessageId}
                                </code>
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(item.smtpMessageId, item.id)}
                                  className="text-slate-400 hover:text-slate-700 p-1 rounded hover:bg-slate-100"
                                  title="Copy Message ID"
                                >
                                  {copiedId === item.id ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1">
                    <span>Target Client Email: <strong className="text-slate-600">{deliveryData.clientEmail || invoice.client?.email || 'N/A'}</strong></span>
                    <span>Total Dispatches Recorded: <strong className="text-slate-700">{deliveryData.deliveries.length}</strong></span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 border border-dashed border-slate-200 rounded-lg bg-slate-50/50">
                  <Mail className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-medium text-slate-700">No email delivery records logged yet</p>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                    This invoice has not been dispatched to {invoice.client?.email || 'the client'} or was generated prior to delivery logging.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-3 text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                    onClick={() => resendMutation.mutate()}
                    disabled={resendMutation.isPending}
                  >
                    <Send className="w-3.5 h-3.5 mr-1.5" />
                    {resendMutation.isPending ? "Dispatching..." : "Send Invoice to Client Now"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Recording Payments & Summaries */}
        <div className="space-y-8">
          <Card>
            <CardHeader><CardTitle className="text-sm font-semibold uppercase tracking-wider text-slate-400">Payment Status</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-slate-500 text-sm">Paid Amount</span>
                <span className="font-bold text-green-600">₹{invoice.amountPaid?.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex items-center justify-between border-b pb-2">
                <span className="text-slate-500 text-sm">Remaining Due</span>
                <span className="font-bold text-red-600">₹{invoice.balanceDue?.toLocaleString('en-IN')}</span>
              </div>
            </CardContent>
          </Card>

          {/* Record payment form */}
          {invoice.balanceDue > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-lg flex items-center gap-2"><CreditCard className="w-5 h-5 text-slate-500" /> Record a Payment</CardTitle></CardHeader>
              <CardContent>
                <form onSubmit={handleRecordPayment} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-600">Amount (INR) *</label>
                    <Input required type="number" max={invoice.balanceDue} placeholder="e.g. 5000" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-600">Method</label>
                    <Select defaultValue="BANK_TRANSFER" onValueChange={(val: any) => setPayMethod(val ?? "BANK_TRANSFER")}>
                      <SelectTrigger><SelectValue placeholder="Select Method" /></SelectTrigger>
                      <SelectContent className="bg-white">
                        <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                        <SelectItem value="CREDIT_CARD">Credit Card</SelectItem>
                        <SelectItem value="CASH">Cash</SelectItem>
                        <SelectItem value="CHECK">Cheque</SelectItem>
                        <SelectItem value="UPI">UPI</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-600">Transaction ID / Ref</label>
                    <Input placeholder="Txn reference number" value={payTxId} onChange={(e) => setPayTxId(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-600">Internal Notes</label>
                    <Input placeholder="Payment source details..." value={payNotes} onChange={(e) => setPayNotes(e.target.value)} />
                  </div>
                  <Button type="submit" className="w-full bg-slate-900 text-white" disabled={recordPaymentMutation.isPending}>
                    {recordPaymentMutation.isPending ? "Recording..." : "Record Payment"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
