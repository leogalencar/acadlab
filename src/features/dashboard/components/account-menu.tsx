"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { UserCog } from "lucide-react";

import { Button } from "@/components/ui/button";
import { signOutAction } from "@/features/auth/server/actions";

interface AccountMenuProps {
  userName: string;
}

export function AccountMenu({ userName }: AccountMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [signingOut, startTransition] = useTransition();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <Button
        variant="ghost"
        size="icon"
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className="rounded-full border border-border/60 bg-background/70 hover:bg-accent"
      >
        <UserCog className="size-5" aria-hidden />
        <span className="sr-only">Abrir menu de configurações</span>
      </Button>

      {open ? (
        <div
          role="menu"
          aria-label="Configurações da conta"
          className="absolute right-0 top-full mt-2 w-56 overflow-hidden rounded-lg border border-border/60 bg-background/95 shadow-lg backdrop-blur"
        >
          <div className="border-b border-border/60 px-4 py-3">
            <p className="text-sm font-medium text-foreground">Conta</p>
            <p className="truncate text-xs text-muted-foreground">{userName}</p>
          </div>
          <div className="flex flex-col p-2">
            <Link
              href="/profile"
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              onClick={() => setOpen(false)}
            >
              Meu perfil
            </Link>
            <button
              type="button"
              disabled={signingOut}
              className="flex w-full rounded-md px-3 py-2 text-left text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40 disabled:cursor-not-allowed disabled:opacity-70"
              onClick={() => {
                setOpen(false);
                startTransition(async () => {
                  await signOutAction();
                });
              }}
            >
              {signingOut ? "Saindo..." : "Sair"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
