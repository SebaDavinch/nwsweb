import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Bell, Loader2 } from "lucide-react";
import { useAuth } from "../context/auth-context";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog";

interface TicketPreview {
  id: string;
  number: number;
  subject: string;
  status: string;
  unreadCount: number;
}

export function TicketBell() {
  const { isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [tickets, setTickets] = useState<TicketPreview[]>([]);

  useEffect(() => {
    if (!isAuthenticated) {
      setUnreadCount(0);
      setTickets([]);
      return;
    }

    let active = true;
    const load = async () => {
      setIsLoading(true);
      try {
        const response = await fetch("/api/tickets", { credentials: "include" });
        if (!response.ok) {
          return;
        }
        const payload = await response.json();
        if (!active) {
          return;
        }
        const items = Array.isArray(payload?.tickets) ? payload.tickets : [];
        setUnreadCount(Number(payload?.unreadCount || 0) || 0);
        setTickets(items.slice(0, 6));
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    load().catch(() => undefined);
    const timer = window.setInterval(() => {
      load().catch(() => undefined);
    }, 30000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon" className="relative h-10 w-10 rounded-full border-red-200 text-[#E31E24] hover:bg-red-50">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 ? (
            <span className="absolute -right-1 -top-1 h-5 min-w-5 rounded-full bg-[#E31E24] px-1 text-[10px] font-bold text-white flex items-center justify-center">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          ) : null}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Ticket notifications</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 max-h-[360px] overflow-auto pr-1">
          {isLoading ? (
            <div className="text-sm text-gray-500 flex items-center"><Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading...</div>
          ) : tickets.length === 0 ? (
            <div className="text-sm text-gray-500">No ticket activity.</div>
          ) : (
            tickets.map((item) => (
              <Link
                key={item.id}
                to="/tickets"
                onClick={() => setOpen(false)}
                className="block rounded-lg border border-gray-200 p-3 hover:bg-gray-50"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="font-medium text-sm text-gray-900 truncate">#{item.number} {item.subject}</div>
                  {item.unreadCount > 0 ? <span className="text-xs rounded bg-[#E31E24] text-white px-2 py-0.5">{item.unreadCount}</span> : null}
                </div>
                <div className="text-xs text-gray-500 mt-1">Status: {item.status}</div>
              </Link>
            ))
          )}
        </div>
        <div className="pt-2 border-t border-gray-100">
          <Link to="/tickets" onClick={() => setOpen(false)} className="text-sm text-[#E31E24] hover:underline">
            Open tickets center
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  );
}
