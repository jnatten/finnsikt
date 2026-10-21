// Minimal decoder for the turbo-stream format React Router uses for `.data` responses.
// The payload is a flat array: objects are `{"_<keyIndex>": valueIndex}`, arrays hold indices,
// negative indices are sentinels (undefined/null/NaN/...), and `["<tag>", ...]` arrays are typed values.
export function decodeTurboStream(text: string): unknown {
  const firstLine = text.split("\n", 1)[0];
  const values: unknown[] = JSON.parse(firstLine);
  const hydrated = new Map<number, unknown>();

  const hydrate = (index: number): unknown => {
    if (index < 0) return undefined;
    if (hydrated.has(index)) return hydrated.get(index);

    const value = values[index];
    if (Array.isArray(value)) {
      if (typeof value[0] === "string") {
        const [tag, payload] = value;
        const typed = tag === "D" ? new Date(payload) : tag === "U" ? payload : undefined;
        hydrated.set(index, typed);
        return typed;
      }
      const array: unknown[] = [];
      hydrated.set(index, array);
      for (const item of value) array.push(typeof item === "number" ? hydrate(item) : item);
      return array;
    }
    if (value !== null && typeof value === "object") {
      const object: Record<string, unknown> = {};
      hydrated.set(index, object);
      for (const [key, valueIndex] of Object.entries(value)) {
        const name = values[Number(key.slice(1))];
        object[String(name)] = typeof valueIndex === "number" ? hydrate(valueIndex) : valueIndex;
      }
      return object;
    }
    hydrated.set(index, value);
    return value;
  };

  return hydrate(0);
}
