"use client";

import type { KeyboardEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, Search, X } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type MultiComboboxOption = {
  value: string;
  label: string;
  description?: string;
};

interface MultiComboboxProps {
  name: string;
  options: MultiComboboxOption[];
  defaultValue?: string[];
  value?: string[];
  onChange?: (values: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  className?: string;
  disabled?: boolean;
  form?: string;
}

const DEFAULT_EMPTY_MESSAGE = "Nenhuma opção disponível.";
const DEFAULT_SEARCH_PLACEHOLDER = "Pesquisar...";
const DEFAULT_PLACEHOLDER = "Selecione opções";

export function MultiCombobox({
  name,
  options,
  defaultValue,
  value,
  onChange,
  placeholder = DEFAULT_PLACEHOLDER,
  searchPlaceholder = DEFAULT_SEARCH_PLACEHOLDER,
  emptyMessage = DEFAULT_EMPTY_MESSAGE,
  className,
  disabled = false,
  form,
}: MultiComboboxProps) {
  const optionsMap = useMemo(() => {
    return new Map(options.map((option) => [option.value, option]));
  }, [options]);

  const sanitizeValues = useCallback(
    (values: string[] | undefined): string[] => {
      if (!values?.length) {
        return [];
      }

      const unique = new Set<string>();
      const sanitized: string[] = [];

      for (const entry of values) {
        if (!optionsMap.has(entry) || unique.has(entry)) {
          continue;
        }
        unique.add(entry);
        sanitized.push(entry);
      }

      return sanitized;
    },
    [optionsMap],
  );

  const isControlled = Array.isArray(value);
  const [internalValues, setInternalValues] = useState<string[]>(() =>
    sanitizeValues(defaultValue),
  );
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isControlled) {
      return;
    }
    setInternalValues(sanitizeValues(defaultValue));
  }, [defaultValue, isControlled, sanitizeValues]);

  const selectedValues = useMemo(() => {
    return isControlled ? sanitizeValues(value) : internalValues;
  }, [internalValues, isControlled, sanitizeValues, value]);

  const selectedSet = useMemo(() => new Set(selectedValues), [selectedValues]);

  const selectedOptions = useMemo(() => {
    return selectedValues
      .map((entry) => optionsMap.get(entry))
      .filter((entry): entry is MultiComboboxOption => Boolean(entry));
  }, [optionsMap, selectedValues]);

  const filteredOptions = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    if (!normalizedSearch) {
      return options;
    }

    return options.filter((option) => {
      const label = option.label.toLowerCase();
      const description = option.description?.toLowerCase() ?? "";

      return label.includes(normalizedSearch) || description.includes(normalizedSearch);
    });
  }, [options, searchTerm]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleOutsideClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);

    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      searchInputRef.current?.focus();
    }
  }, [isOpen]);

  const commitValues = useCallback(
    (next: string[]) => {
      if (!isControlled) {
        setInternalValues(next);
      }
      onChange?.(next);
    },
    [isControlled, onChange],
  );

  const toggleValue = useCallback(
    (entry: string) => {
      const nextValues = selectedSet.has(entry)
        ? selectedValues.filter((value) => value !== entry)
        : [...selectedValues, entry];
      commitValues(nextValues);
    },
    [commitValues, selectedSet, selectedValues],
  );

  const removeValue = useCallback(
    (entry: string) => {
      if (!selectedSet.has(entry)) {
        return;
      }
      const nextValues = selectedValues.filter((value) => value !== entry);
      commitValues(nextValues);
    },
    [commitValues, selectedSet, selectedValues],
  );

  const clearAll = useCallback(() => {
    if (selectedValues.length === 0) {
      return;
    }
    commitValues([]);
  }, [commitValues, selectedValues.length]);

  const handleToggleDropdown = () => {
    if (disabled) {
      return;
    }
    setIsOpen((current) => !current);
  };

  const handleTriggerKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled) {
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setIsOpen((current) => !current);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIsOpen(true);
      return;
    }

    if (event.key === "Escape" && isOpen) {
      event.preventDefault();
      setIsOpen(false);
    }
  };

  const triggerClassName = cn(
    buttonVariants({ variant: "outline" }),
    "flex w-full items-center justify-between gap-2 truncate border-border/70 bg-background text-left text-sm",
    disabled && "cursor-not-allowed opacity-70",
  );

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div
        role="combobox"
        tabIndex={disabled ? -1 : 0}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-disabled={disabled}
        onClick={handleToggleDropdown}
        onKeyDown={handleTriggerKeyDown}
        className={triggerClassName}
      >
        <span className="flex flex-1 flex-wrap items-center gap-2">
          {selectedOptions.length > 0 ? (
            selectedOptions.map((option) => (
              <span
                key={option.value}
                className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
              >
                {option.label}
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    removeValue(option.value);
                  }}
                  className="rounded-full p-0.5 hover:bg-primary/20"
                  aria-label={`Remover ${option.label}`}
                  disabled={disabled}
                >
                  <X className="h-3 w-3" aria-hidden />
                </button>
              </span>
            ))
          ) : (
            <span className="truncate text-muted-foreground">{placeholder}</span>
          )}
        </span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      </div>

      {isOpen ? (
        <div className="absolute z-50 mt-2 w-full rounded-lg border border-border/60 bg-card shadow-lg">
          <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground" aria-hidden />
            <Input
              ref={searchInputRef}
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={searchPlaceholder}
              className="h-8 border-none px-0 text-sm shadow-none focus-visible:ring-0"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearAll}
              disabled={selectedValues.length === 0}
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              Limpar
            </Button>
          </div>

          <div className="max-h-60 overflow-y-auto py-2 text-sm">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => {
                const isSelected = selectedSet.has(option.value);

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => toggleValue(option.value)}
                    className={cn(
                      "flex w-full items-start gap-3 px-3 py-2 text-left transition-colors",
                      isSelected
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-muted/60 hover:text-foreground",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex h-4 w-4 items-center justify-center rounded-sm border border-border/70",
                        isSelected ? "border-primary bg-primary text-primary-foreground" : "",
                      )}
                      aria-hidden
                    >
                      {isSelected ? <Check className="h-3 w-3" /> : null}
                    </span>
                    <span className="flex flex-col">
                      <span className="font-medium">{option.label}</span>
                      {option.description ? (
                        <span className="text-xs text-muted-foreground">{option.description}</span>
                      ) : null}
                    </span>
                  </button>
                );
              })
            ) : (
              <p className="px-3 py-4 text-center text-sm text-muted-foreground">{emptyMessage}</p>
            )}
          </div>
        </div>
      ) : null}

      {selectedValues.map((entry) => (
        <input key={entry} type="hidden" name={name} value={entry} form={form} />
      ))}
    </div>
  );
}

export type { MultiComboboxOption };
