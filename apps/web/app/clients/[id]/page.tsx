"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "../../../src/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { Button } from "../../../components/ui/button";
import { Building, Phone, Mail, Globe, MapPin, User, FileText, Briefcase, Ticket, Activity, AlertTriangle, RefreshCw, ArrowLeft } from "lucide-react";
import { use } from "react";
import Link from "next/link";

export default function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const id = resolvedParams.id;

  const { data: client, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['client', id],
    queryFn: async () => {
      const { data } = await api.get(`/clients/${id}`);
      return data;
    },
    retry: 1,
  });

  if (isLoading) return (
    <div className="p-8 flex items-center justify-center min-h-[400px]">
      <div className="text-center space-y-3">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-slate-500 text-sm">Loading client details...</p>
      </div>
    </div>
  );

  if (isError || !client) {
    const errMsg = (error as any)?.response?.data?.message;
    const status = (error as any)?.response?.status;
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4 max-w-md">
          <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto">
            <AlertTriangle className="w-7 h-7 text-red-600" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">
            {status === 403 ? 'Access Denied' : status === 404 ? 'Client Not Found' : 'Failed to Load Client'}
          </h2>
          <p className="text-slate-500 text-sm">
            {status === 403
              ? 'You do not have permission to view this client. Contact your administrator.'
              : status === 404
              ? 'This client does not exist or may have been deleted.'
              : errMsg || 'Unable to load client data. Please check your connection and try again.'}
          </p>
          <div className="flex gap-3 justify-center">
            <Link href="/clients">
              <Button variant="outline" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" /> Back to Clients
              </Button>
            </Link>
            {status !== 403 && status !== 404 && (
              <Button size="sm" onClick={() => refetch()}>
                <RefreshCw className="w-4 h-4 mr-2" /> Retry
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }



  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Building className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">{client.name}</h1>
            <Badge variant={client.status === 'ACTIVE' ? 'default' : 'secondary'}>{client.status}</Badge>
            <Badge variant="outline" className="border-blue-200 text-blue-700 bg-blue-50">{client.tier}</Badge>
          </div>
          <p className="text-slate-500">{client.industry || 'No Industry Specified'} &bull; State: {client.state || 'N/A'}</p>
        </div>
        <div className="flex gap-2">
          {client.website && (
            <Button variant="outline" size="sm" onClick={() => window.open(client.website, '_blank')}>
              <Globe className="w-4 h-4 mr-2" /> Website
            </Button>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        {/* Left column: Contact Info & Persons */}
        <div className="space-y-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Building className="w-5 h-5 text-slate-500" /> Company Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3 text-sm text-slate-600">
                <MapPin className="w-4 h-4 text-slate-400 mt-1 shrink-0" />
                <span>{client.address || 'No address provided'}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-600">
                <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                <span>{client.email || 'No email provided'}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-slate-600">
                <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                <span>{client.phone || 'No phone provided'}</span>
              </div>
              {client.notes && (
                <div className="pt-4 border-t">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Notes</span>
                  <p className="text-xs text-slate-600 mt-1">{client.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="w-5 h-5 text-slate-500" /> Contacts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {client.contactPersons?.length ? (
                client.contactPersons.map((person: any) => (
                  <div key={person.id} className="p-3 border rounded-lg space-y-2 bg-slate-50 relative">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-semibold text-slate-900 text-sm">{person.name}</h4>
                        <span className="text-xs text-slate-500">{person.role}</span>
                      </div>
                      {person.isPrimary && (
                        <Badge variant="default" className="text-[10px] px-1.5 py-0.5 bg-blue-600">Primary</Badge>
                      )}
                    </div>
                    <div className="text-xs text-slate-600 space-y-1">
                      <div className="flex items-center gap-1.5"><Mail className="w-3 h-3 text-slate-400" /> {person.email}</div>
                      {person.phone && <div className="flex items-center gap-1.5"><Phone className="w-3 h-3 text-slate-400" /> {person.phone}</div>}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-slate-500 text-sm">No contact persons registered.</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Columns: Projects, Tickets, Invoices, Timeline */}
        <div className="md:col-span-2 space-y-8">
          {/* Projects */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-slate-500" /> Active Projects
              </CardTitle>
            </CardHeader>
            <CardContent>
              {client.projects?.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Project Name</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Budget</TableHead>
                      <TableHead>Dates</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {client.projects.map((proj: any) => (
                      <TableRow key={proj.id} className="cursor-pointer hover:bg-slate-50" onClick={() => window.location.href = `/projects/${proj.id}`}>
                        <TableCell className="font-semibold text-blue-600">{proj.name}</TableCell>
                        <TableCell><Badge variant="outline">{proj.status}</Badge></TableCell>
                        <TableCell>₹{proj.budget?.toLocaleString('en-IN')}</TableCell>
                        <TableCell className="text-xs text-slate-500">{proj.startDate} to {proj.endDate}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-slate-500 text-sm">No active projects found.</p>
              )}
            </CardContent>
          </Card>

          {/* Tickets */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Ticket className="w-5 h-5 text-slate-500" /> Support Tickets
              </CardTitle>
            </CardHeader>
            <CardContent>
              {client.tickets?.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ticket</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {client.tickets.map((t: any) => (
                      <TableRow key={t.id} className="cursor-pointer hover:bg-slate-50" onClick={() => window.location.href = `/tickets/${t.id}`}>
                        <TableCell className="font-semibold">
                          <div>{t.title}</div>
                          <span className="text-xs text-slate-500 font-normal">{t.category}</span>
                        </TableCell>
                        <TableCell><Badge variant="outline">{t.status}</Badge></TableCell>
                        <TableCell>
                          <Badge variant={t.priority === 'CRITICAL' ? 'destructive' : 'secondary'}>{t.priority}</Badge>
                        </TableCell>
                        <TableCell className="text-xs text-slate-500">{t.createdAt}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-slate-500 text-sm">No support tickets found.</p>
              )}
            </CardContent>
          </Card>

          {/* Invoices */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="w-5 h-5 text-slate-500" /> Invoices
              </CardTitle>
            </CardHeader>
            <CardContent>
              {client.invoices?.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice No.</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Total</TableHead>
                      <TableHead>Balance Due</TableHead>
                      <TableHead>Due Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {client.invoices.map((inv: any) => (
                      <TableRow key={inv.id} className="cursor-pointer hover:bg-slate-50" onClick={() => window.location.href = `/billing/${inv.id}`}>
                        <TableCell className="font-semibold text-blue-600">{inv.invoiceNumber}</TableCell>
                        <TableCell>
                          <Badge variant={inv.status === 'paid' ? 'default' : inv.status === 'overdue' ? 'destructive' : 'outline'}>
                            {inv.status}
                          </Badge>
                        </TableCell>
                        <TableCell>₹{inv.totalAmount?.toLocaleString('en-IN')}</TableCell>
                        <TableCell className="font-semibold text-slate-700">₹{inv.balanceDue?.toLocaleString('en-IN')}</TableCell>
                        <TableCell className="text-xs text-slate-500">{inv.dueDate}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-slate-500 text-sm">No invoices found.</p>
              )}
            </CardContent>
          </Card>

          {/* Activity Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="w-5 h-5 text-slate-500" /> Activity Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flow-root">
                <ul className="-mb-8">
                  {client.activities?.length ? (
                    client.activities.map((act: any, actIdx: number) => (
                      <li key={act.id}>
                        <div className="relative pb-8">
                          {actIdx !== client.activities.length - 1 ? (
                            <span className="absolute left-5 top-5 -ml-px h-full w-0.5 bg-gray-200" aria-hidden="true" />
                          ) : null}
                          <div className="relative flex items-start space-x-3">
                            <div>
                              <span className="relative flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 ring-8 ring-white">
                                <Activity className="h-5 w-5 text-slate-500" aria-hidden="true" />
                              </span>
                            </div>
                            <div className="min-w-0 flex-1 py-1.5">
                              <div className="text-sm text-slate-800">
                                {act.description}
                              </div>
                              <div className="mt-1 text-xs text-slate-400">
                                {new Date(act.createdAt).toLocaleString()}
                              </div>
                            </div>
                          </div>
                        </div>
                      </li>
                    ))
                  ) : (
                    <p className="text-slate-500 text-sm">No timeline activities registered.</p>
                  )}
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
