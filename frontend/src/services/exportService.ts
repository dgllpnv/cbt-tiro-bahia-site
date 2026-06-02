import api from './api';

export type ExportFormat = 'json' | 'csv';

/**
 * Baixa o backup completo do banco (cifrado) no formato indicado.
 * O token JWT vai no header do axios — por isso usamos a instancia `api`
 * com responseType blob, e nao um <a href> direto.
 */
export async function exportDatabase(format: ExportFormat, passphrase: string) {
  try {
    const response = await api.post(
      '/api/export/database',
      { format, passphrase },
      { responseType: 'blob' },
    );

    const cd = (response.headers['content-disposition'] as string) || '';
    const match = /filename="?([^"]+)"?/.exec(cd);
    const filename = match ? match[1] : `cbt-backup.${format}.enc`;

    const url = URL.createObjectURL(response.data as Blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    return { success: true as const };
  } catch (error: any) {
    // Com responseType blob, o corpo de erro tambem vem como Blob.
    let msg = 'Erro ao exportar banco de dados';
    try {
      const data = error.response?.data;
      if (data instanceof Blob) {
        const text = await data.text();
        msg = JSON.parse(text).error || msg;
      } else if (data?.error) {
        msg = data.error;
      }
    } catch {
      /* mantem msg padrao */
    }
    return { success: false as const, error: msg };
  }
}
