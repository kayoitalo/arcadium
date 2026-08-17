"use client";

import { useEffect, useState, useMemo } from "react";
import { Search, ChevronLeft, ChevronRight, History, Disc, Clock } from "lucide-react";
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from "@tanstack/react-table";
import { MotionDiv, MotionPage } from "@/components/ui/motion";

interface HistoryEvent {
  id: string;
  playedAt: string;
  rawArtistName: string;
  rawTrackName: string;
  rawAlbumName?: string;
  provider: string;
}

export default function HistoryPage() {
  const [events, setEvents] = useState<HistoryEvent[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchHistory() {
      setLoading(true);
      setError(null);
      try {
        const query = new URLSearchParams({
          page: page.toString(),
          limit: "20",
          search,
        });
        const res = await fetch(`/api/history?${query.toString()}`);
        if (!res.ok) throw new Error("Não foi possível carregar o histórico.");
        const json = await res.json();
        setEvents(json.events || []);
        setTotalPages(json.totalPages || 1);
        setTotalItems(json.totalItems || 0);
      } catch (err) {
        console.error("Failed to load history", err);
        setError(err instanceof Error ? err.message : "Não foi possível carregar o histórico.");
      } finally {
        setLoading(false);
      }
    }

    const timeout = setTimeout(fetchHistory, 300);
    return () => clearTimeout(timeout);
  }, [page, search]);

  const getAvatarGradient = (name: string) => {
    const charCode = name.charCodeAt(0) || 65;
    const hue = (charCode * 41) % 360;
    return `hsl(${hue}, 35%, 25%)`;
  };

  const columns: any[] = useMemo(
    () => [
      {
        id: "trackAndArtist",
        header: "Faixa e artista",
        accessorFn: (row: any) => row,
        cell: (info: any) => {
          const event = info.getValue();
          return (
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-text-primary text-xs flex-shrink-0 shadow-card border border-border/50"
                style={{ backgroundColor: getAvatarGradient(event.rawArtistName) }}
              >
                <Disc className="w-4 h-4 text-accent-gold" />
              </div>
              <div>
                <span className="font-semibold text-text-primary block group-hover:text-accent-gold transition-colors">
                  {event.rawTrackName}
                </span>
                <span className="text-xs text-text-secondary block">
                  {event.rawArtistName}
                </span>
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: "rawAlbumName",
        header: "Álbum",
        cell: (info: any) => {
          const val = info.getValue();
          return val ? (
            <span className="px-2 py-1 rounded-md bg-surface border border-border/60 font-mono text-xs text-text-muted">
              {val}
            </span>
          ) : (
            <span className="text-xs text-text-muted">--</span>
          );
        },
      },
      {
        accessorKey: "playedAt",
        header: () => <div className="text-right">Ouvida em</div>,
        cell: (info: any) => (
          <div className="flex items-center justify-end gap-1.5 text-xs text-text-muted font-mono">
            <Clock className="w-3.5 h-3.5 text-text-muted" />
            {new Date(info.getValue()).toLocaleString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
        ),
      },
    ],
    []
  );

  const table = useReactTable({
    data: events,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
  });

  return (
    <MotionPage className="space-y-8 pb-12">
      {/* Editorial Header */}
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 rounded-2xl bg-surface/40 border border-border/60">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-accent-gold" />
            <h1 className="font-serif text-3xl font-bold tracking-tight text-text-primary">
              Histórico de audições
            </h1>
          </div>
          <p className="text-text-secondary text-xs font-sans">
            Eventos armazenados em ordem cronológica ({totalItems.toLocaleString("pt-BR")} registros).
          </p>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Buscar artista, faixa ou álbum..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface border border-border/80 text-xs focus:outline-none focus:border-accent-gold text-text-primary placeholder:text-text-muted transition-colors font-sans"
          />
        </div>
      </header>

      {/* Container */}
      <MotionDiv className="rounded-2xl bg-surface/40 border border-border/60 overflow-hidden shadow-card">
        {loading ? (
          <div className="py-20 text-center text-text-muted text-xs font-mono animate-pulse">
            Carregando histórico…
          </div>
        ) : error ? (
          <div className="py-20 text-center text-status-error text-xs font-mono">{error}</div>
        ) : events.length === 0 ? (
          <div className="py-20 text-center text-text-muted text-xs font-mono">
            {search ? "Nenhuma audição corresponde à busca." : "Nenhuma audição foi armazenada."}
          </div>
        ) : (
          <>
            {/* Desktop / Tablet Table View */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-xs font-sans">
                <thead className="bg-surface-elevated/70 text-[10px] font-mono font-semibold text-text-muted uppercase tracking-wider border-b border-border/60">
                  {table.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <th key={header.id} className="py-3.5 px-6">
                          {header.isPlaceholder
                            ? null
                            : flexRender(header.column.columnDef.header, header.getContext())}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody className="divide-y divide-border/30">
                  {table.getRowModel().rows.map((row) => (
                    <tr key={row.id} className="hover:bg-surface-elevated/50 transition-colors group">
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="py-4 px-6">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Vertical List View */}
            <div className="sm:hidden divide-y divide-border/30">
              {events.map((event) => (
                <div key={event.id} className="p-4 space-y-2 hover:bg-surface-elevated/40 transition-colors">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-text-primary text-xs flex-shrink-0 shadow-card border border-border/50"
                      style={{ backgroundColor: getAvatarGradient(event.rawArtistName) }}
                    >
                      <Disc className="w-4 h-4 text-accent-gold" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="font-semibold text-text-primary text-xs block truncate">
                        {event.rawTrackName}
                      </span>
                      <span className="text-[11px] text-text-secondary block truncate">
                        {event.rawArtistName}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[10px] font-mono text-text-muted pt-1">
                    <span className="truncate max-w-[180px]">
                      {event.rawAlbumName ? `Álbum: ${event.rawAlbumName}` : "Álbum não informado"}
                    </span>
                    <span>
                      {new Date(event.playedAt).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Pagination */}
        <div className="p-4 border-t border-border/60 flex items-center justify-between text-xs text-text-secondary font-mono">
          <span>
            Página {page} de {totalPages || 1}
          </span>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="p-2 rounded-xl border border-border/80 bg-surface disabled:opacity-30 hover:bg-surface-elevated transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="p-2 rounded-xl border border-border/80 bg-surface disabled:opacity-30 hover:bg-surface-elevated transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </MotionDiv>
    </MotionPage>
  );
}
