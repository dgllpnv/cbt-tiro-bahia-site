import { useState, useEffect } from 'react';
import PageHeader from '@/components/shared/PageHeader';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import EmptyState from '@/components/shared/EmptyState';
import SearchInput from '@/components/shared/SearchInput';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatDateTime } from '@/lib/formatters';
import { ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import api from '@/services/api';

const actionColors: Record<string, string> = {
  CREATE: 'bg-green-900/50 text-green-400 border-green-700/50',
  UPDATE: 'bg-blue-900/50 text-blue-400 border-blue-700/50',
  DELETE: 'bg-red-900/50 text-red-400 border-red-700/50',
  LOGIN: 'bg-purple-900/50 text-purple-400 border-purple-700/50',
  PASSWORD_CHANGE: 'bg-yellow-900/50 text-yellow-400 border-yellow-700/50',
  STATUS_CHANGE: 'bg-orange-900/50 text-orange-400 border-orange-700/50',
  STOCK_ADJUSTMENT: 'bg-cyan-900/50 text-cyan-400 border-cyan-700/50',
  PAYMENT_RECEIVED: 'bg-emerald-900/50 text-emerald-400 border-emerald-700/50',
};

const AuditLogsPage = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedLog, setSelectedLog] = useState<any>(null);

  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      try {
        const res = await api.get('/api/audit-logs', { params: { page, limit: 20, entityType: search || undefined } });
        if (res.data.success) { setLogs(res.data.data); setTotalPages(res.data.pagination?.totalPages || 1); }
      } catch {}
      setLoading(false);
    };
    fetchLogs();
  }, [page, search]);

  return (
    <div>
      <PageHeader title="Logs de Auditoria" description="Registro de todas as alteracoes — somente leitura" />
      <div className="mb-4"><SearchInput value={search} onChange={(v) => { setSearch(v); setPage(1); }} placeholder="Filtrar por tipo de entidade..." /></div>

      {loading ? <LoadingSpinner /> : logs.length === 0 ? <EmptyState title="Nenhum log" icon={<FileText className="w-8 h-8 text-gray-500" />} /> : (
        <>
          <div className="bg-gray-900/50 border border-gray-800 rounded-lg overflow-hidden">
            <Table><TableHeader><TableRow className="border-gray-800 hover:bg-transparent">
              <TableHead className="text-gray-400 font-tactical">Data/Hora</TableHead>
              <TableHead className="text-gray-400 font-tactical">Acao</TableHead>
              <TableHead className="text-gray-400 font-tactical">Entidade</TableHead>
              <TableHead className="text-gray-400 font-tactical">Descricao</TableHead>
              <TableHead className="text-gray-400 font-tactical">Por</TableHead>
              <TableHead className="text-gray-400 font-tactical">Det.</TableHead>
            </TableRow></TableHeader>
            <TableBody>{logs.map((log: any) => (
              <TableRow key={log.id} className="border-gray-800">
                <TableCell className="text-gray-400 font-tactical text-xs whitespace-nowrap">{formatDateTime(log.createdAt)}</TableCell>
                <TableCell><Badge variant="outline" className={`font-tactical text-xs ${actionColors[log.action] || 'border-gray-600 text-gray-400'}`}>{log.action}</Badge></TableCell>
                <TableCell className="text-gray-300 font-tactical text-sm">{log.entityType}</TableCell>
                <TableCell className="text-white font-tactical text-sm max-w-xs truncate">{log.description}</TableCell>
                <TableCell className="text-gray-400 font-tactical text-sm">{log.performedBy?.fullName}</TableCell>
                <TableCell>{(log.previousData || log.newData) && <Button variant="ghost" size="sm" onClick={() => setSelectedLog(log)} className="text-cbt-orange text-xs">Ver</Button>}</TableCell>
              </TableRow>
            ))}</TableBody></Table>
          </div>
          <div className="flex items-center justify-between mt-4">
            <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="font-tactical text-gray-400"><ChevronLeft size={16} className="mr-1" />Anterior</Button>
            <span className="text-gray-500 font-tactical text-sm">Pagina {page}/{totalPages}</span>
            <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="font-tactical text-gray-400">Proximo<ChevronRight size={16} className="ml-1" /></Button>
          </div>
        </>
      )}

      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-military">Detalhe do Log</DialogTitle></DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm font-tactical">
                <div><span className="text-gray-500">Acao:</span> <span className="text-white">{selectedLog.action}</span></div>
                <div><span className="text-gray-500">Entidade:</span> <span className="text-white">{selectedLog.entityType}</span></div>
                <div><span className="text-gray-500">Data:</span> <span className="text-white">{formatDateTime(selectedLog.createdAt)}</span></div>
                <div><span className="text-gray-500">Por:</span> <span className="text-white">{selectedLog.performedBy?.fullName}</span></div>
              </div>
              <p className="text-white font-tactical text-sm">{selectedLog.description}</p>
              {selectedLog.previousData && <div><span className="text-gray-500 text-sm font-tactical">Antes:</span><pre className="bg-gray-800 border border-gray-700 rounded p-3 text-xs text-gray-300 mt-1 overflow-x-auto">{JSON.stringify(selectedLog.previousData, null, 2)}</pre></div>}
              {selectedLog.newData && <div><span className="text-gray-500 text-sm font-tactical">Depois:</span><pre className="bg-gray-800 border border-gray-700 rounded p-3 text-xs text-green-300 mt-1 overflow-x-auto">{JSON.stringify(selectedLog.newData, null, 2)}</pre></div>}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AuditLogsPage;
