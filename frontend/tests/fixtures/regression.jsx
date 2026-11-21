// Fixture nhỏ để kiểm tra modal lồng nhau và màn hình dự phòng khi render lỗi.
import { useState } from "react";
import { createRoot } from "react-dom/client";
import Modal from "../../src/components/Modal.jsx";
import ErrorBoundary from "../../src/components/ErrorBoundary.jsx";
import "../../src/styles/styles.css";
function Broken() {
  throw new Error("Expected test render failure");
}
function Harness() {
  const [outer, setOuter] = useState(false);
  const [inner, setInner] = useState(false);
  const [fresh, setFresh] = useState(false);
  const [result, setResult] = useState("");
  const [broken, setBroken] = useState(false);
  return (
    <>
      <button onClick={() => setOuter(true)}>Open outer</button>
      <button onClick={() => setBroken(true)}>Break render</button>
      <output>{result}</output>
      {broken && <Broken />}
      {outer && (
        <Modal
          title="Outer"
          onClose={() => {
            setResult(fresh ? "fresh" : "stale");
            setOuter(false);
          }}
        >
          <button onClick={() => setInner(true)}>Open inner</button>
          <button onClick={() => setFresh(true)}>Change callback</button>
        </Modal>
      )}
      {inner && (
        <Modal title="Inner" onClose={() => setInner(false)}>
          <button onClick={() => setOuter(false)}>Close parent first</button>
        </Modal>
      )}
    </>
  );
}
createRoot(document.getElementById("root")).render(
  <ErrorBoundary>
    <Harness />
  </ErrorBoundary>,
);
