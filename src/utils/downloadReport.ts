/**
 * Secure Report Downloader Helper for TECH BRIDGE '26 Admin Dashboard
 * Handles authenticated file downloads (CSV, XLSX, JSON) with Bearer token authentication,
 * blob creation, and automatic browser download triggering.
 */

export interface DownloadReportOptions {
  url: string;
  adminToken: string | null;
  filename?: string;
  onSuccess?: (filename: string) => void;
  onError?: (error: string) => void;
}

export async function downloadReportFile({
  url,
  adminToken,
  filename,
  onSuccess,
  onError,
}: DownloadReportOptions): Promise<boolean> {
  try {
    const separator = url.includes('?') ? '&' : '?';
    const authUrl = adminToken ? `${url}${separator}token=${encodeURIComponent(adminToken)}` : url;

    const res = await fetch(authUrl, {
      method: 'GET',
      headers: {
        ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
      },
    });

    if (!res.ok) {
      let errMsg = `Download failed with status ${res.status}`;
      try {
        const json = await res.json();
        if (json.error) errMsg = json.error;
      } catch {
        // ignore
      }
      throw new Error(errMsg);
    }

    // Try to get filename from Content-Disposition header
    let downloadName = filename;
    const disposition = res.headers.get('content-disposition');
    if (disposition && !downloadName) {
      const match = disposition.match(/filename="?([^";]+)"?/i);
      if (match && match[1]) {
        downloadName = match[1].trim();
      }
    }

    if (!downloadName) {
      downloadName = `TechBridge_Report_${new Date().toISOString().split('T')[0]}`;
      if (url.includes('xlsx')) downloadName += '.xlsx';
      else if (url.includes('json')) downloadName += '.json';
      else downloadName += '.csv';
    }

    const blob = await res.blob();
    const objectUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = downloadName;
    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
      document.body.removeChild(link);
      window.URL.revokeObjectURL(objectUrl);
    }, 200);

    onSuccess?.(downloadName);
    return true;
  } catch (err: any) {
    const errorMsg = err?.message || 'Failed to download report';
    console.error('Report download error:', err);
    onError?.(errorMsg);
    return false;
  }
}
