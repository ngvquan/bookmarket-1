// File PDF thật lấy từ backend; ebook dữ liệu mẫu cũ vẫn dùng PDF minh họa để không mất chức năng.
import { useEffect, useRef, useState } from "react";
import { BookOpen, Download } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { Modal } from "./index.js";
import { apiMessage, ebookService } from "../services/api.js";

export default function Reader({ book, onClose }) {
  const previewOnly = Boolean(book.previewOnly);
  const [url, setUrl] = useState("");
  const [pdfBlob, setPdfBlob] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    let objectUrl;
    async function openPdf() {
      try {
        let blob;
        if (book.hasEbook) {
          blob = await (previewOnly
            ? ebookService.preview(book.id)
            : ebookService.full(book.id));
        } else {
          // Ebook mẫu cũ không có file server: tạo bản minh họa, xem thử chỉ gồm 2 trang.
          const { createDemoPdf } = await import("../utils/pdf.js");
          blob = new Blob(
            [await createDemoPdf(book, { preview: previewOnly })],
            { type: "application/pdf" },
          );
        }
        if (active) setPdfBlob(blob);
        objectUrl = URL.createObjectURL(blob);
        if (active) setUrl(objectUrl);
        else URL.revokeObjectURL(objectUrl);
      } catch (error) {
        if (active) setError(apiMessage(error));
      }
    }
    openPdf();
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [book.id, book.hasEbook, previewOnly]);

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
          {previewOnly ? "Bản xem trước · tối đa 2 trang" : "Ebook đầy đủ"}
        </span>
        {url && !previewOnly && (
          <a
            href={url}
            download={`bookmarket-${book.id}.pdf`}
            className="text-link"
          >
            Tải PDF
            <Download size={15} />
          </a>
        )}
      </div>
      {error ? (
        <p className="info-box" role="alert">
          {error}
        </p>
      ) : url ? (
        Capacitor.isNativePlatform() ? (
          <MobilePdfViewer blob={pdfBlob} title={book.title} />
        ) : (
          <iframe className="pdf-frame" title={`Đọc ${book.title}`} src={url} />
        )
      ) : (
        <div className="empty-state">
          <BookOpen size={35} />
          <p>Đang mở ebook…</p>
        </div>
      )}
      <p className="fine-print">
        File đầy đủ chỉ được cấp cho chủ ebook hoặc tài khoản đã thanh toán
        thành công.
      </p>
    </Modal>
  );
}

function MobilePdfViewer({ blob, title }) {
  const containerRef = useRef(null);
  const [renderError, setRenderError] = useState("");

  useEffect(() => {
    if (!blob) return;
    let cancelled = false;
    let documentTask;
    let pdfDocument;

    async function renderPdf() {
      try {
        const pdfjs = await import("pdfjs-dist");
        const workerUrl = (
          await import("pdfjs-dist/build/pdf.worker.min.mjs?url")
        ).default;
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
        documentTask = pdfjs.getDocument({
          data: new Uint8Array(await blob.arrayBuffer()),
        });
        pdfDocument = await documentTask.promise;
        if (cancelled) return;

        const container = containerRef.current;
        container.replaceChildren();
        const availableWidth = Math.max(container.clientWidth - 24, 260);
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

        for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber++) {
          if (cancelled) return;
          const page = await pdfDocument.getPage(pageNumber);
          const initialViewport = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({
            scale: availableWidth / initialViewport.width,
          });
          const canvas = document.createElement("canvas");
          canvas.className = "pdf-page-canvas";
          canvas.setAttribute("aria-label", `Trang ${pageNumber} của ${title}`);
          canvas.width = Math.floor(viewport.width * pixelRatio);
          canvas.height = Math.floor(viewport.height * pixelRatio);
          canvas.style.width = `${Math.floor(viewport.width)}px`;
          canvas.style.height = `${Math.floor(viewport.height)}px`;
          container.appendChild(canvas);
          await page.render({
            canvasContext: canvas.getContext("2d"),
            viewport,
            transform:
              pixelRatio === 1
                ? undefined
                : [pixelRatio, 0, 0, pixelRatio, 0, 0],
          }).promise;
        }
      } catch (error) {
        if (!cancelled) {
          setRenderError(error.message || "Không hiển thị được file PDF.");
        }
      }
    }

    renderPdf();
    return () => {
      cancelled = true;
      documentTask?.destroy();
      pdfDocument?.destroy();
    };
  }, [blob, title]);

  if (renderError) {
    return (
      <p className="info-box mobile-pdf-error" role="alert">
        {renderError}
      </p>
    );
  }

  return (
    <div
      ref={containerRef}
      className="pdf-frame mobile-pdf-pages"
      aria-label={`Đọc ${title}`}
    >
      <div className="mobile-pdf-loading">Đang hiển thị trang sách…</div>
    </div>
  );
}
