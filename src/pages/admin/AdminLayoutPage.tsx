import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import AdminLeftNav from "./AdminLeftNav";
import AdminDictionaryDrawer from "./AdminDictionaryDrawer";
import { adminShell } from "./adminUi";

export default function AdminLayoutPage() {
  const [dictOpen, setDictOpen] = useState(false);
  const [dictPrefill, setDictPrefill] = useState<string | undefined>(undefined);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setDictOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const handler = (e: any) => {
      const text = e?.detail?.text;
      if (typeof text === "string" && text.trim()) {
        setDictPrefill(text.trim());
        setDictOpen(true);
      }
    };

    window.addEventListener("dictionary:add", handler as any);
    return () => window.removeEventListener("dictionary:add", handler as any);
  }, []);

  return (
    <div style={adminShell}>
      <div style={{ position: "sticky", top: 16, alignSelf: "start" }}>
        <AdminLeftNav
          onOpenDictionary={() => {
            setDictPrefill(undefined);
            setDictOpen(true);
          }}
        />
      </div>

      <div style={{ minWidth: 0 }}>
        <Outlet />
      </div>

      <AdminDictionaryDrawer
        open={dictOpen}
        onClose={() => setDictOpen(false)}
        initialQuery={dictPrefill}
      />
    </div>
  );
}
