import { useEffect, useRef, useState } from "react";
import { BookOpen, ChevronLeft, ChevronRight, Download, Minus, Plus } from "lucide-react";
import { Modal } from "./index.js";
import { apiMessage, ebookService } from "../services/api.js";

export default function Reader({ book, onClose }) {
  const previewOnly = Boolean(book.previewOnly);
  const [pdfBlob, setPdfBlob] = useState(null);
  const [downloadUrl, setDownloadUrl] = useState("");
  const [pdfDocument, setPdfDocument] = useState(null);
  const [error, setError] = useState("");
  const [pageNumber, setPageNumber] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const [zoomPercent, setZoomPercent] = useState(100);

  useEffect(() => {
    let active = true;
    let objectUrl;
    setPdfBlob(null);
    setDownloadUrl("");
    setPdfDocument(null);
    setError("");
    setPageNumber(1);
    setPageInput("1");
    setZoomPercent(100);

    async function openPdf() {
      try {
        let blob;
        if (book.hasEbook) {
          blob = await (previewOnly
            ? ebookService.preview(book.id)
            : ebookService.full(book.id));
        } else {
          const { createDemoPdf } = await import("../utils/pdf.js");
          blob = new Blob(
            [await createDemoPdf(book, { preview: previewOnly })],
            { type: "application/pdf" },
          );
        }
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setPdfBlob(blob);
        setDownloadUrl(objectUrl);
      } catch (loadError) {
        if (active) setError(apiMessage(loadError));
      }
    }

    openPdf();
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [book.id, book.hasEbook, previewOnly]);

  useEffect(() => {
    if (!pdfBlob) return;
    let active = true;
    let documentTask;
    setPdfDocument(null);

    async function loadDocument() {
      try {
        const pdfjs = await import("pdfjs-dist");
        const workerUrl = (
          await import("pdfjs-dist/build/pdf.worker.min.mjs?url")
        ).default;
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
        if (!active) return;
        documentTask = pdfjs.getDocument({
          data: new Uint8Array(await pdfBlob.arrayBuffer()),
        });
        const loadedDocument = await documentTask.promise;
        if (active) setPdfDocument(loadedDocument);
      } catch (loadError) {
        if (active) setError(loadError.message || "Không mở được file PDF.");
      }
    }

    loadDocument();
    return () => {
      active = false;
      documentTask?.destroy();
    };
  }, [pdfBlob]);

  useEffect(() => setPageInput(String(pageNumber)), [pageNumber]);

  const totalPages = pdfDocument?.numPages || 0;

  function goToPage(nextPage) {
    if (!totalPages) return;
    const page = Math.min(totalPages, Math.max(1, nextPage));
    setPageNumber(page);
    setPageInput(String(page));
  }

  function submitPage(event) {
    event.preventDefault();
    const requested = Number.parseInt(pageInput, 10);
    goToPage(Number.isFinite(requested) ? requested : pageNumber);
    event.currentTarget.querySelector("input")?.blur();
  }

  return (
    <Modal
      title={`${previewOnly ? "ĐỌC THỬ" : "ĐANG ĐỌC"} · ${book.title}`}
      wide
      className="reader-modal"
      onClose={onClose}
    >
      <div className="reader-toolbar">
        <span>
          <BookOpen size={16} />
          {previewOnly ? "Bản xem trước" : "Ebook đầy đủ"}
        </span>
        {downloadUrl && !previewOnly && (
          <a href={downloadUrl} download={`bookmarket-${book.id}.pdf`} className="text-link">
            Tải PDF <Download size={16} />
          </a>
        )}
      </div>

      {error ? (
        <p className="info-box reader-error" role="alert">{error}</p>
      ) : pdfDocument ? (
        <div className="reader-content">
          <div className="reader-controls" aria-label="Điều khiển đọc sách">
            <div className="reader-page-controls">
              <button type="button" className="reader-control-button" aria-label="Trang trước"
                disabled={pageNumber <= 1} onClick={() => goToPage(pageNumber - 1)}>
                <ChevronLeft size={18} />
              </button>
              <form className="reader-page-form" onSubmit={submitPage}>
                <span>Trang</span>
                <input type="number" min="1" max={totalPages} value={pageInput}
                  aria-label="Đi đến trang" onChange={(event) => setPageInput(event.target.value)} />
                <span>/ {totalPages}</span>
              </form>
              <button type="button" className="reader-control-button" aria-label="Trang sau"
                disabled={pageNumber >= totalPages} onClick={() => goToPage(pageNumber + 1)}>
                <ChevronRight size={18} />
              </button>
            </div>
            <div className="reader-zoom-controls">
              <button type="button" className="reader-control-button" aria-label="Thu nhỏ"
                disabled={zoomPercent <= 60} onClick={() => setZoomPercent((value) => value - 20)}>
                <Minus size={16} />
              </button>
              <span aria-live="polite">{zoomPercent}%</span>
              <button type="button" className="reader-control-button" aria-label="Phóng to"
                disabled={zoomPercent >= 200} onClick={() => setZoomPercent((value) => value + 20)}>
                <Plus size={16} />
              </button>
            </div>
          </div>
          <PdfPage pdfDocument={pdfDocument} pageNumber={pageNumber}
            zoom={zoomPercent / 100} title={book.title} onError={setError} />
        </div>
      ) : (
        <div className="empty-state reader-loading" role="status">
          <BookOpen size={35} />
          <p>Đang mở ebook…</p>
        </div>
      )}

      <p className="fine-print">
        File đầy đủ chỉ được cấp cho chủ ebook hoặc tài khoản đã thanh toán thành công.
      </p>
    </Modal>
  );
}

function PdfPage({ pdfDocument, pageNumber, zoom, title, onError }) {
  const stageRef = useRef(null);
  const canvasHolderRef = useRef(null);
  const [stageWidth, setStageWidth] = useState(0);
  const [rendering, setRendering] = useState(true);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const measure = () => setStageWidth(stage.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!stageWidth) return;
    let active = true;
    let renderTask;
    const holder = canvasHolderRef.current;
    const stage = stageRef.current;
    holder.replaceChildren();
    stage.scrollTop = 0;
    stage.scrollLeft = 0;
    setRendering(true);

    async function renderPage() {
      try {
        const page = await pdfDocument.getPage(pageNumber);
        if (!active) return;
        const base = page.getViewport({ scale: 1 });
        const width = Math.min(Math.max(stageWidth - 48, 240), 860);
        const viewport = page.getViewport({ scale: (width / base.width) * zoom });
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        const canvas = document.createElement("canvas");
        canvas.className = "reader-page-canvas";
        canvas.setAttribute("aria-label", `Trang ${pageNumber} của ${title}`);
        canvas.width = Math.ceil(viewport.width * pixelRatio);
        canvas.height = Math.ceil(viewport.height * pixelRatio);
        canvas.style.width = `${Math.ceil(viewport.width)}px`;
        canvas.style.height = `${Math.ceil(viewport.height)}px`;
        holder.appendChild(canvas);
        renderTask = page.render({
          canvasContext: canvas.getContext("2d"),
          viewport,
          transform: pixelRatio === 1 ? undefined : [pixelRatio, 0, 0, pixelRatio, 0, 0],
        });
        await renderTask.promise;
        if (active) setRendering(false);
      } catch (renderError) {
        if (active && renderError.name !== "RenderingCancelledException") {
          onError(renderError.message || "Không hiển thị được trang sách.");
        }
      }
    }

    renderPage();
    return () => {
      active = false;
      renderTask?.cancel();
    };
  }, [pdfDocument, pageNumber, zoom, stageWidth, title, onError]);

  return (
    <div className="reader-page-stage" ref={stageRef} aria-label={`Đọc ${title}`}>
      <div className="reader-page-holder" ref={canvasHolderRef} />
      {rendering && <span className="reader-page-loading" role="status">Đang hiển thị trang…</span>}
    </div>
  );
}
