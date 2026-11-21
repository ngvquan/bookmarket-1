import { useState } from "react";
const priceValue = (value) =>
  value !== null &&
  value !== "" &&
  Number.isFinite(Number(value)) &&
  Number(value) >= 0
    ? String(Number(value))
    : "";

export default function PriceRange({ min, max }) {
  const [lower, setLower] = useState(() => priceValue(min));
  return (
    <fieldset className="price-range">
      <legend>Khoảng giá</legend>
      <div className="price-range-inputs">
        <label>
          Giá từ (₫)
          <input
            type="number"
            name="min"
            aria-label="Giá từ"
            min="0"
            step="1"
            value={lower}
            onChange={(event) => setLower(event.target.value)}
            placeholder="0"
          />
        </label>
        <label>
          Giá đến (₫)
          <input
            type="number"
            name="max"
            aria-label="Giá đến"
            min={Math.max(0, Number(lower) || 0)}
            step="1"
            defaultValue={priceValue(max)}
            placeholder="Không giới hạn"
          />
        </label>
      </div>
    </fieldset>
  );
}
