"use client";

import { FieldTip } from "@/components/entry/field-tip";
import {
  memo,
  useState,
  useMemo,
  useEffect,
  forwardRef,
  useCallback,
  useRef,
  useId,
  createContext,
  useContext,
} from "react";
import {
  useForm,
  useFieldArray,
  useFormContext,
  useWatch,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { editComponents } from "@/fields/registry";
import {
  initializeState,
  getDefaultValue,
  generateZodSchema,
  sanitizeObject,
} from "@/lib/schema";
import { Field } from "@/types/field";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DndContext,
  closestCenter,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  restrictToVerticalAxis,
  restrictToParentElement,
} from "@dnd-kit/modifiers";
import { CSS } from "@dnd-kit/utilities";
import {
  Ban,
  Asterisk,
  X,
  GripVertical,
  Plus,
  Trash2,
  ChevronsDownUp,
  ChevronsUpDown,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { interpolate } from "@/lib/schema";
import { t } from "@/lib/i18n";
import { SeoPreview } from "@/components/seo-preview";
import { useUser } from "@/contexts/user-context";
import { useIsBuilderView } from "@/lib/client-view";

type BeforeSubmitHook = () => void | Promise<void>;
type RegisterBeforeSubmitHook = (
  key: string,
  hook: BeforeSubmitHook,
) => () => void;

type FieldWithReadonlyMeta = Field & {
  __inheritedReadonly?: boolean;
};

type RenderFields = (
  fields: FieldWithReadonlyMeta[],
  parentName?: string,
  registerBeforeSubmitHook?: RegisterBeforeSubmitHook,
  runBeforeSubmitHooks?: () => Promise<void>,
  inheritedReadonly?: boolean,
  keyPrefix?: string,
) => React.ReactNode[];

type NestedFieldProps = {
  field: FieldWithReadonlyMeta;
  fieldName: string;
  renderFields: RenderFields;
  registerBeforeSubmitHook?: RegisterBeforeSubmitHook;
  isOpen?: boolean;
  onToggleOpen?: () => void;
  index?: number;
  keyPrefix?: string;
};

const hasFieldPathError = (errors: unknown, fieldName: string): boolean => {
  let current: unknown = errors;
  for (const part of fieldName.split(".")) {
    if (typeof current !== "object" || current === null || !(part in current)) {
      return false;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return Boolean(current);
};

const getCollapsibleItemLabel = (
  field: Field,
  fieldValues: unknown,
  index?: number,
): string => {
  if (
    typeof field.list === "object" &&
    field.list.collapsible &&
    typeof field.list.collapsible === "object" &&
    field.list.collapsible.summary
  ) {
    return interpolate(
      field.list.collapsible.summary,
      {
        index: index !== undefined ? `${index + 1}` : "",
        fields: fieldValues as Record<string, unknown>,
      },
      "fields",
    );
  }

  return (index !== undefined ? t("Item #{number}", { number: index + 1 }) : t("Item"));
};

const hasCollapsibleSummary = (field: Field) =>
  typeof field.list === "object" &&
  !!field.list.collapsible &&
  typeof field.list.collapsible === "object" &&
  !!field.list.collapsible.summary;

const hasExplicitReadonly = (field: Field) =>
  Boolean(field.readonly) &&
  !(field as FieldWithReadonlyMeta).__inheritedReadonly;

// On phones every level of nesting used to cost a column for the drag handle
// on the left and one for the bin on the right, until the fields inside were
// too narrow to read. There the handle and the bin go into the item's own
// header instead. The header of a nested item sets its own value, and the
// body of an item resets it, so the actions never end up one level too deep.
const ItemHeaderActionsContext = createContext<React.ReactNode>(null);

const useIsPhone = () => {
  const [isPhone, setIsPhone] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 639px)");
    const update = () => setIsPhone(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return isPhone;
};

const ItemHeaderActions = () => {
  const actions = useContext(ItemHeaderActionsContext);
  if (!actions) return null;
  return (
    // Tapping the handle or the bin (or anything in its dialog) must not
    // also open or close the item.
    <span className="-my-1 flex shrink-0 items-center" onClick={(event) => event.stopPropagation()}>
      {actions}
    </span>
  );
};

const NoItemHeaderActions = ({ children }: { children: React.ReactNode }) => (
  <ItemHeaderActionsContext.Provider value={null}>{children}</ItemHeaderActionsContext.Provider>
);

const SortableItem = ({
  id,
  children,
  readonly = false,
  removeButton,
  actionsInHeader = false,
}: {
  id: string;
  children: React.ReactNode;
  readonly?: boolean;
  removeButton?: React.ReactNode;
  actionsInHeader?: boolean;
}) => {
  const {
    attributes,
    isDragging,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  const handle = !readonly && (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={t("Move")}
      className={cn(
        "cursor-move touch-none text-muted-foreground hover:text-foreground",
        actionsInHeader ? "size-10" : "h-auto w-6 self-stretch",
      )}
      {...attributes}
      {...listeners}
    >
      <GripVertical />
    </Button>
  );

  if (actionsInHeader) {
    return (
      <div
        ref={setNodeRef}
        className={cn("min-w-0", isDragging ? "opacity-50 z-50" : "z-10")}
        style={style}
      >
        <ItemHeaderActionsContext.Provider value={<>{removeButton}{handle}</>}>
          {children}
        </ItemHeaderActionsContext.Provider>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex items-center gap-x-1",
        isDragging ? "opacity-50 z-50" : "z-10",
      )}
      style={style}
    >
      {handle}
      <NoItemHeaderActions>{children}</NoItemHeaderActions>
      {removeButton}
    </div>
  );
};

const ListItemRow = memo(function ListItemRow({
  id,
  field,
  fieldName,
  index,
  isOpen,
  defaultOpen,
  isPendingRemove,
  renderFields,
  registerBeforeSubmitHook,
  onToggleOpen,
  onRequestRemove,
  onRemoveConfirm,
  onPendingRemoveChange,
}: {
  id: string;
  field: FieldWithReadonlyMeta;
  fieldName: string;
  index: number;
  isOpen?: boolean;
  defaultOpen: boolean;
  isPendingRemove: boolean;
  renderFields: RenderFields;
  registerBeforeSubmitHook?: RegisterBeforeSubmitHook;
  onToggleOpen: (index: number) => void;
  onRequestRemove: (index: number) => void;
  onRemoveConfirm: (index: number) => void;
  onPendingRemoveChange: (index: number, open: boolean) => void;
}) {
  const isReadonly = Boolean(field.readonly);
  const isPhone = useIsPhone();
  // Items that are shown as a box with a header (blocks, and objects that
  // fold open and shut) carry their handle and bin in that header on phones.
  const hasHeader =
    field.type === "block" ||
    (field.type === "object" &&
      !(typeof field.list === "object" && field.list?.collapsible === false));
  const actionsInHeader = isPhone && hasHeader;

  const removeButton = !isReadonly && (
    <Tooltip>
      <AlertDialog
        open={isPendingRemove}
        onOpenChange={(open) => onPendingRemoveChange(index, open)}
      >
        <TooltipTrigger asChild>
          <AlertDialogTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t("Remove item")}
              className={cn(
                "text-muted-foreground hover:text-foreground",
                actionsInHeader ? "size-10" : "self-start max-sm:size-12",
              )}
              onClick={() => onRequestRemove(index)}
            >
              <Trash2 />
            </Button>
          </AlertDialogTrigger>
        </TooltipTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("Remove this item?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("This action cannot be undone.")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => onRemoveConfirm(index)}>
              {t("Remove")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <TooltipContent>{t("Remove item")}</TooltipContent>
    </Tooltip>
  );

  return (
    <SortableItem
      id={id}
      readonly={isReadonly}
      removeButton={removeButton}
      actionsInHeader={actionsInHeader}
    >
      <div className="grid gap-6 flex-1 min-w-0">
        <SingleField
          field={field}
          fieldName={`${fieldName}.${index}`}
          keyPrefix={id}
          renderFields={renderFields}
          registerBeforeSubmitHook={registerBeforeSubmitHook}
          showLabel={false}
          isOpen={isOpen ?? defaultOpen}
          toggleOpen={() => onToggleOpen(index)}
          index={index}
        />
      </div>
    </SortableItem>
  );
});

const ListField = ({
  field,
  fieldName,
  renderFields,
  registerBeforeSubmitHook,
  runBeforeSubmitHooks,
}: {
  field: FieldWithReadonlyMeta;
  fieldName: string;
  renderFields: RenderFields;
  registerBeforeSubmitHook?: RegisterBeforeSubmitHook;
  runBeforeSubmitHooks?: () => Promise<void>;
}) => {
  const supportsItemCollapse =
    field.type === "object" || field.type === "block";
  const isCollapsible = !!(
    supportsItemCollapse &&
    field.list &&
    !(typeof field.list === "object" && field.list?.collapsible === false)
  );
  const defaultOpen = useMemo(() => {
    const defaultCollapsed =
      isCollapsible &&
      typeof field.list === "object" &&
      field.list.collapsible &&
      typeof field.list.collapsible === "object" &&
      field.list.collapsible.collapsed;
    return !defaultCollapsed;
  }, [field.list, isCollapsible]);

  const {
    fields: arrayFields,
    append,
    remove,
    move,
  } = useFieldArray({
    name: fieldName,
  });
  const [openStates, setOpenStates] = useState<boolean[]>([]);
  const shouldShowListHeader =
    field.label !== false ||
    field.required ||
    (isCollapsible && arrayFields.length > 0);
  const isReadonly = Boolean(field.readonly);

  useEffect(() => {
    setOpenStates((prev) => {
      if (prev.length === arrayFields.length) {
        return prev;
      }
      if (prev.length === 0 && arrayFields.length > 0) {
        return Array(arrayFields.length).fill(defaultOpen);
      }
      if (prev.length < arrayFields.length) {
        return [
          ...prev,
          ...Array(arrayFields.length - prev.length).fill(defaultOpen),
        ];
      }
      return prev.slice(0, arrayFields.length);
    });
  }, [arrayFields.length, defaultOpen]);

  const toggleOpen = useCallback((index: number) => {
    setOpenStates((prev) =>
      prev.map((isOpen, currentIndex) =>
        currentIndex === index ? !isOpen : isOpen,
      ),
    );
  }, []);

  const handleDragEnd = async (event: DragEndEvent) => {
    if (isReadonly) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = arrayFields.findIndex((item) => item.id === active.id);
    const newIndex = arrayFields.findIndex((item) => item.id === over.id);

    if (oldIndex < 0 || newIndex < 0) return;

    await runBeforeSubmitHooks?.();
    setOpenStates((prev) => arrayMove(prev, oldIndex, newIndex));
    move(oldIndex, newIndex);
  };

  const addItem = async () => {
    if (isReadonly) return;
    await runBeforeSubmitHooks?.();
    append(
      field.type === "object"
        ? initializeState(field.fields, {})
        : getDefaultValue(field),
    );
    setOpenStates((prev) => [...prev, true]);
  };

  const removeItem = useCallback(
    async (index: number) => {
      if (isReadonly) return;
      await runBeforeSubmitHooks?.();
      remove(index);
      setOpenStates((prev) =>
        prev.filter((_, currentIndex) => currentIndex !== index),
      );
    },
    [isReadonly, remove, runBeforeSubmitHooks],
  );
  const [pendingRemoveIndex, setPendingRemoveIndex] = useState<number | null>(
    null,
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const modifiers = useMemo(
    () => [restrictToVerticalAxis, restrictToParentElement],
    [],
  );
  const sortableItems = useMemo(
    () => arrayFields.map((item) => item.id),
    [arrayFields],
  );

  const handleToggleOpen = useCallback(
    (index: number) => {
      toggleOpen(index);
    },
    [toggleOpen],
  );
  const handleRequestRemove = useCallback((index: number) => {
    setPendingRemoveIndex(index);
  }, []);
  const handlePendingRemoveChange = useCallback(
    (index: number, open: boolean) => {
      if (open) return;
      setPendingRemoveIndex((prev) => (prev === index ? null : prev));
    },
    [],
  );
  const handleRemoveConfirm = useCallback(
    (index: number) => {
      removeItem(index);
      setPendingRemoveIndex(null);
    },
    [removeItem],
  );

  const toggleAll = (collapsed: boolean) => {
    setOpenStates(Array(arrayFields.length).fill(!collapsed));
  };

  // We don't render <FormMessage/> in ListField, because it's already rendered in the individual fields
  return (
    <FormField
      name={fieldName}
      render={() => (
        <FormItem data-field={fieldName}>
          {shouldShowListHeader && (
            <div className="flex items-center h-5 gap-x-2">
              {field.label !== false && (
                <FormLabel className="text-sm font-medium">
                  {field.label || field.name}
                </FormLabel>
              )}
              <FieldTip field={field} />
              {field.required && (
                <Badge variant="secondary" className="text-muted-foreground">
                  <Asterisk className="-ml-1 -mr-0.5" />
                  {t("Required")}
                </Badge>
              )}
              {hasExplicitReadonly(field) && (
                <Badge variant="secondary" className="text-muted-foreground">
                  <Ban className="-ml-0.5" />
                  {t("Readonly")}
                </Badge>
              )}
              {isCollapsible &&
                arrayFields.length > 0 &&
                (() => {
                  const isAllExpanded =
                    openStates.length > 0 && openStates.every(Boolean);
                  return (
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      className="ml-auto text-muted-foreground hover:text-foreground"
                      onClick={() => toggleAll(isAllExpanded)}
                    >
                      {isAllExpanded ? <ChevronsDownUp /> : <ChevronsUpDown />}
                      {isAllExpanded ? t("Collapse all") : t("Expand all")}
                    </Button>
                  );
                })()}
            </div>
          )}
          {shouldShowListHeader && field.description && (
            <FormDescription className="-mt-1">{field.description}</FormDescription>
          )}
          <div className="space-y-2">
            <DndContext
              sensors={sensors}
              modifiers={modifiers}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={sortableItems}
                strategy={verticalListSortingStrategy}
              >
                {arrayFields.map((arrayField, index) => (
                  <ListItemRow
                    key={arrayField.id}
                    id={arrayField.id}
                    field={field}
                    fieldName={fieldName}
                    index={index}
                    isOpen={openStates[index]}
                    defaultOpen={defaultOpen}
                    isPendingRemove={pendingRemoveIndex === index}
                    renderFields={renderFields}
                    registerBeforeSubmitHook={registerBeforeSubmitHook}
                    onToggleOpen={handleToggleOpen}
                    onRequestRemove={handleRequestRemove}
                    onRemoveConfirm={handleRemoveConfirm}
                    onPendingRemoveChange={handlePendingRemoveChange}
                  />
                ))}
              </SortableContext>
            </DndContext>
            <div className="flex items-center gap-2 flex-wrap">
              {isReadonly ? null : typeof field.list === "object" &&
                field.list?.max &&
                arrayFields.length >= field.list.max ? null : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addItem}
                >
                  <Plus />
                  {t("Add an item")}
                </Button>
              )}
            </div>
            <FormMessage />
          </div>
        </FormItem>
      )}
    />
  );
};

const BlocksField = forwardRef<HTMLDivElement, NestedFieldProps>(
  (props, ref) => {
    const { user } = useUser();
    const builderView = useIsBuilderView();
    const canManageRepo = builderView;
    const {
      field,
      fieldName,
      renderFields,
      registerBeforeSubmitHook,
      isOpen,
      onToggleOpen,
      index,
      keyPrefix,
    } = props;

    const isCollapsible = !!(
      field.list &&
      !(typeof field.list === "object" && field.list?.collapsible === false)
    );

    const {
      control,
      setValue,
      formState: { errors },
    } = useFormContext();

    const value = useWatch({ control, name: fieldName });
    const onChange = (val: Record<string, unknown> | null) => {
      setValue(fieldName, val, { shouldDirty: true });
    };

    const hasErrors = () => {
      return hasFieldPathError(errors, fieldName);
    };

    const { blocks = [] } = field;
    const blockKey = field.blockKey || "_block";
    const selectedBlockName = value?.[blockKey];
    // A block that may be used once (a hero) is not offered again while the
    // list already has it.
    const listName = field.list && typeof index === "number" ? fieldName.replace(/\.\d+$/, "") : fieldName;
    const siblings = useWatch({ control, name: listName });
    const choosableBlocks = useMemo(() => {
      if (!field.list || !Array.isArray(siblings)) return blocks;
      const used = new Set(
        siblings
          .filter((item: unknown, itemIndex: number) => itemIndex !== index && item && typeof item === "object")
          .map((item: Record<string, unknown>) => item[blockKey]),
      );
      return blocks.filter((block: Field) => !(block.once && used.has(block.name)));
    }, [blocks, blockKey, field.list, index, siblings]);
    const [isRemoveBlockDialogOpen, setIsRemoveBlockDialogOpen] =
      useState(false);
    const isReadonly = Boolean(field.readonly);

    const handleBlockSelect = (blockName: string) => {
      if (isReadonly) return;
      const selectedBlockDef = blocks.find((b: Field) => b.name === blockName);
      if (!selectedBlockDef) return;
      let initialState: Record<string, unknown> = { [blockKey]: blockName };
      if (selectedBlockDef.fields) {
        const choiceDefaults = initializeState(selectedBlockDef.fields, {});
        initialState = { ...initialState, ...choiceDefaults };
      }
      onChange(initialState);
    };

    const handleRemoveBlock = () => {
      if (isReadonly) return;
      onChange(null);
    };

    const selectedBlockDefinition = useMemo(() => {
      const definition = blocks.find(
        (b: Field) => b.name === selectedBlockName,
      );
      return definition;
    }, [blocks, selectedBlockName]);

    const itemLabel = getCollapsibleItemLabel(field, value, index);

    return (
      <div className="space-y-3" ref={ref as React.Ref<HTMLDivElement>}>
        {!selectedBlockDefinition ? (
          <div className="rounded-lg border p-4 space-y-4">
            <div className="text-sm">Choose content block:</div>
            <div className="flex flex-wrap gap-2">
              {choosableBlocks.map((blockDef: Field) => (
                <Button
                  key={blockDef.name}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-x-2"
                  onClick={() => handleBlockSelect(blockDef.name)}
                  disabled={isReadonly}
                >
                  {blockDef.label || blockDef.name}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <div className="border rounded-lg">
            <header
              className={cn(
                "flex items-center gap-x-2 px-3 sm:px-4 min-h-12 sm:min-h-8.5 py-1.5 sm:py-0 text-base sm:text-sm font-medium transition-colors rounded-t-lg",
                isOpen ? "" : "rounded-b-lg",
                isCollapsible ? "cursor-pointer hover:bg-muted" : "",
              )}
              onClick={isCollapsible ? onToggleOpen : undefined}
            >
              {isCollapsible && (
                <>
                  <ChevronRight
                    className={cn(
                      "size-4 transition-transform shrink-0",
                      isOpen ? "rotate-90" : "",
                    )}
                  />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span
                      className={cn(
                        "truncate",
                        hasErrors() ? "text-destructive" : "",
                      )}
                    >
                      {itemLabel}
                    </span>
                    {/* On phones the kind of block goes under the title,
                        so the title itself gets the whole width. */}
                    {!canManageRepo && (
                      <span className="truncate text-xs font-normal text-muted-foreground sm:hidden">
                        {selectedBlockDefinition.label || selectedBlockDefinition.name}
                      </span>
                    )}
                  </span>
                </>
              )}
              <Badge
                className={cn(
                  "text-muted-foreground ml-auto -mr-2 min-w-0 max-w-[55%] shrink",
                  !canManageRepo && isCollapsible && "max-sm:hidden",
                )}
                variant="outline"
              >
                <span className="truncate">
                  {selectedBlockDefinition.label || selectedBlockDefinition.name}
                </span>

                {/* Clients remove a block with the bin next to it; this cross
                    (empty the block and pick another type) is only for builders. */}
                {!isReadonly && canManageRepo && (
                  <Tooltip>
                    <AlertDialog
                      open={isRemoveBlockDialogOpen}
                      onOpenChange={setIsRemoveBlockDialogOpen}
                    >
                      <TooltipTrigger asChild>
                        <AlertDialogTrigger asChild>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setIsRemoveBlockDialogOpen(true);
                            }}
                            className="text-muted-foreground hover:text-foreground -my-0.5 -mx-2 px-2 transition-colors"
                          >
                            <X className="size-3" />
                          </button>
                        </AlertDialogTrigger>
                      </TooltipTrigger>
                      <AlertDialogContent
                        onClick={(event) => event.stopPropagation()}
                      >
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            {t("Remove this block?")}
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            {t("This action cannot be undone.")}
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{t("Cancel")}</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => {
                              handleRemoveBlock();
                              setIsRemoveBlockDialogOpen(false);
                            }}
                          >
                            {t("Remove")}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    <TooltipContent>{t("Remove block")}</TooltipContent>
                  </Tooltip>
                )}
              </Badge>
              <ItemHeaderActions />
            </header>
            <div
              className={cn("p-3 sm:p-4 grid gap-6 border-t", isOpen ? "" : "hidden")}
            >
              <NoItemHeaderActions>
              {selectedBlockDefinition.type === "object" ? (
                (() => {
                  const renderedElements = renderFields(
                    selectedBlockDefinition.fields || [],
                    fieldName,
                    registerBeforeSubmitHook,
                    undefined,
                    isReadonly,
                    keyPrefix,
                  );
                  return renderedElements;
                })()
              ) : (
                <SingleField
                  field={
                    isReadonly
                      ? {
                          ...selectedBlockDefinition,
                          readonly: true,
                          __inheritedReadonly: true,
                        }
                      : selectedBlockDefinition
                  }
                  fieldName={fieldName}
                  keyPrefix={keyPrefix}
                  renderFields={renderFields}
                  registerBeforeSubmitHook={registerBeforeSubmitHook}
                  showLabel={false}
                />
              )}
              </NoItemHeaderActions>
            </div>
          </div>
        )}
      </div>
    );
  },
);

BlocksField.displayName = "BlocksField";

const ObjectFieldSummaryLabel = ({
  field,
  fieldName,
  index,
}: {
  field: FieldWithReadonlyMeta;
  fieldName: string;
  index?: number;
}) => {
  const { control } = useFormContext();
  const fieldValues = useWatch({ control, name: fieldName });
  return <>{getCollapsibleItemLabel(field, fieldValues, index)}</>;
};

const ObjectField = forwardRef<HTMLDivElement, NestedFieldProps>(
  (props, ref) => {
    const {
      field,
      fieldName,
      renderFields,
      registerBeforeSubmitHook,
      isOpen = true,
      onToggleOpen = () => {},
      index,
      keyPrefix,
    } = props;

    const isCollapsible = !!(
      field.list &&
      !(typeof field.list === "object" && field.list?.collapsible === false)
    );

    const {
      formState: { errors },
    } = useFormContext();

    const hasErrors = () => {
      return hasFieldPathError(errors, fieldName);
    };

    const itemLabel = hasCollapsibleSummary(field) ? (
      <ObjectFieldSummaryLabel
        field={field}
        fieldName={fieldName}
        index={index}
      />
    ) : (
      (index !== undefined ? t("Item #{number}", { number: index + 1 }) : t("Item"))
    );

    return (
      <div className="border rounded-lg">
        {isCollapsible && (
          <header
            className={cn(
              "flex items-center gap-x-2 rounded-t-lg pl-3 sm:pl-4 pr-1 min-h-12 sm:min-h-8.5 text-base sm:text-sm font-medium hover:bg-muted transition-colors cursor-pointer",
              isOpen ? "" : "rounded-b-lg",
            )}
            onClick={onToggleOpen}
          >
            <ChevronRight
              className={cn(
                "size-4 transition-transform",
                isOpen ? "rotate-90" : "",
              )}
            />
            <span className={cn("min-w-0 flex-1 truncate", hasErrors() ? "text-destructive" : "")}>
              {itemLabel}
            </span>
            <ItemHeaderActions />
          </header>
        )}
        <div
          className={cn(
            "p-3 sm:p-4 grid gap-6",
            isCollapsible && "border-t",
            isOpen ? "" : "hidden",
          )}
        >
          <NoItemHeaderActions>
            {renderFields(
              field.fields || [],
              fieldName,
              registerBeforeSubmitHook,
              undefined,
              Boolean(field.readonly),
              keyPrefix,
            )}
          </NoItemHeaderActions>
        </div>
      </div>
    );
  },
);

ObjectField.displayName = "ObjectField";

const SingleField = ({
  field,
  fieldName,
  renderFields,
  registerBeforeSubmitHook,
  onChangeRegistered,
  showLabel = true,
  isOpen = true,
  toggleOpen = () => {},
  index = 0,
  keyPrefix,
}: {
  field: FieldWithReadonlyMeta;
  fieldName: string;
  renderFields: RenderFields;
  registerBeforeSubmitHook?: RegisterBeforeSubmitHook;
  onChangeRegistered?: () => void;
  showLabel?: boolean;
  isOpen?: boolean;
  toggleOpen?: () => void;
  index?: number;
  keyPrefix?: string;
}) => {
  const {
    control,
    formState: { errors },
  } = useFormContext();
  const isRichTextField = field.type === "rich-text";
  const showLabelSlot = isRichTextField && field.options?.switcher !== false;
  const shouldShowFieldMeta =
    showLabel && (field.label !== false || field.required || showLabelSlot);
  const rawLabelSlotId = useId();
  const labelSlotId = useMemo(
    () => `field-label-slot-${rawLabelSlotId.replace(/[^a-zA-Z0-9_-]/g, "")}`,
    [rawLabelSlotId],
  );

  const isCollapsible = !!(
    field.list &&
    !(typeof field.list === "object" && field.list?.collapsible === false)
  );

  if (["object", "block"].includes(field.type)) {
    const hasErrors = () => hasFieldPathError(errors, fieldName);
    const NestedComponent = field.type === "block" ? BlocksField : ObjectField;

    return (
      <FormItem key={fieldName} data-field={fieldName}>
        {shouldShowFieldMeta && (
          <div className="flex items-center h-5 gap-x-2">
            {field.label !== false && (
              <Label className={hasErrors() ? "text-destructive" : ""}>
                {field.label || field.name}
              </Label>
            )}
            <FieldTip field={field} />
            {field.required && (
              <Badge variant="secondary" className="text-muted-foreground">
                <Asterisk className="-ml-1 -mr-0.5" />
                {t("Required")}
              </Badge>
            )}
            {hasExplicitReadonly(field) && (
              <Badge variant="secondary" className="text-muted-foreground">
                <Ban className="-ml-0.5" />
                {t("Readonly")}
              </Badge>
            )}
          </div>
        )}
        <NestedComponent
          field={field}
          fieldName={fieldName}
          keyPrefix={keyPrefix}
          renderFields={renderFields}
          registerBeforeSubmitHook={registerBeforeSubmitHook}
          isOpen={isOpen}
          onToggleOpen={isCollapsible ? toggleOpen : undefined}
          index={isCollapsible ? index : undefined}
        />
        {field.type === "object" && !field.list && (field.options as any)?.seo && (
          <SeoPreview fieldName={fieldName} field={field} />
        )}
        {field.description && showLabel && (
          <FormDescription>{field.description}</FormDescription>
        )}
      </FormItem>
    );
  } else {
    let FieldComponent;

    if (typeof field.type === "string" && editComponents[field.type]) {
      FieldComponent = editComponents[field.type];
    } else {
      console.warn(
        `No component found for field type: ${field.type}. Defaulting to 'text'.`,
      );
      FieldComponent = editComponents["text"];
    }

    return (
      <FormField
        name={fieldName}
        control={control}
        render={({ field: rhfManagedFieldProps }) => (
          <FormItem data-field={fieldName}>
            {shouldShowFieldMeta && (
              <div className="flex items-center justify-between min-h-6 gap-x-2">
                <div className="flex items-center gap-x-2 min-w-0">
                  {field.label !== false && (
                    <FormLabel>{field.label || field.name}</FormLabel>
                  )}
                  <FieldTip field={field} />
                  {field.required && (
                    <Badge
                      variant="secondary"
                      className="text-muted-foreground"
                    >
                      <Asterisk className="-ml-1 -mr-0.5" />
                      {t("Required")}
                    </Badge>
                  )}
                  {hasExplicitReadonly(field) && (
                    <Badge
                      variant="secondary"
                      className="text-muted-foreground"
                    >
                      <Ban className="-ml-0.5" />
                      {t("Readonly")}
                    </Badge>
                  )}
                </div>
                {showLabelSlot && <div id={labelSlotId} className="shrink-0" />}
              </div>
            )}
            <FormControl>
              {(() => {
                const sharedProps = {
                  ...rhfManagedFieldProps,
                  field,
                };
                if (field.type === "rich-text") {
                  return (
                    <FieldComponent
                      {...sharedProps}
                      labelSlotId={showLabelSlot ? labelSlotId : undefined}
                      registerBeforeSubmitHook={registerBeforeSubmitHook}
                      onChangeRegistered={onChangeRegistered}
                    />
                  );
                }
                return <FieldComponent {...sharedProps} />;
              })()}
            </FormControl>
            {field.description && showLabel && (
              <FormDescription>{field.description}</FormDescription>
            )}
            <FormMessage />
          </FormItem>
        )}
      />
    );
  }
};

SingleField.displayName = "SingleField";

export type EntryFormApi = {
  getValues: (name?: string) => unknown;
  setValue: (name: string, value: unknown) => void;
  /** Writes what is still in the text editors into the form (before moving blocks). */
  syncEditors: () => Promise<void>;
  /** Loads other values into the whole form (undo, redo, unsaved work from last time). */
  restore: (values: Record<string, unknown>) => void;
};

const EntryForm = ({
  fields,
  contentObject,
  onSubmit = () => {},
  filePath,
  onDirtyChange,
  onChangeRegistered,
  onValuesChange,
  formApiRef,
}: {
  fields: Field[];
  contentObject?: Record<string, unknown>;
  onSubmit: (values: Record<string, unknown>) => void;
  filePath?: React.ReactNode;
  onDirtyChange?: (isDirty: boolean) => void;
  onChangeRegistered?: () => void;
  onValuesChange?: (values: Record<string, unknown>) => void;
  /** Lets the page change values from outside the form (editing in the live preview). */
  formApiRef?: React.MutableRefObject<EntryFormApi | null>;
}) => {
  const zodSchema = useMemo(() => {
    return generateZodSchema(fields);
  }, [fields]);

  const defaultValues = useMemo(() => {
    return initializeState(fields, sanitizeObject(contentObject));
  }, [fields, contentObject]);

  const form = useForm({
    resolver: zodSchema && zodResolver(zodSchema),
    defaultValues,
    reValidateMode: "onSubmit",
  });

  useEffect(() => {
    form.reset(defaultValues);
  }, [defaultValues, form]);

  useEffect(() => {
    onDirtyChange?.(form.formState.isDirty);
  }, [form.formState.isDirty, onDirtyChange]);

  // Report every change (used by the live preview).
  useEffect(() => {
    if (!onValuesChange) return;
    onValuesChange(form.getValues() as Record<string, unknown>);
    const subscription = form.watch((values) => {
      onValuesChange(values as Record<string, unknown>);
    });
    return () => subscription.unsubscribe();
  }, [form, onValuesChange, defaultValues]);

  const beforeSubmitHooksRef = useRef<Map<string, BeforeSubmitHook>>(new Map());

  const registerBeforeSubmitHook = useCallback(
    (key: string, hook: BeforeSubmitHook) => {
      beforeSubmitHooksRef.current.set(key, hook);
      return () => {
        beforeSubmitHooksRef.current.delete(key);
      };
    },
    [],
  );

  useEffect(() => {
    if (!formApiRef) return;
    formApiRef.current = {
      getValues: (name) => (name ? form.getValues(name as any) : form.getValues()),
      setValue: (name, value) =>
        form.setValue(name as any, value as any, { shouldDirty: true, shouldTouch: true, shouldValidate: false }),
      syncEditors: async () => {
        for (const hook of Array.from(beforeSubmitHooksRef.current.values())) await hook();
      },
      restore: (values) => form.reset(values as any, { keepDefaultValues: true }),
    };
    return () => {
      formApiRef.current = null;
    };
  }, [form, formApiRef]);

  const renderFields: RenderFields = useCallback(
    (
      fields: FieldWithReadonlyMeta[],
      parentName?: string,
      registerBeforeSubmitHook?: RegisterBeforeSubmitHook,
      runBeforeSubmitHooks?: () => Promise<void>,
      inheritedReadonly = false,
      keyPrefix?: string,
    ): React.ReactNode[] => {
      return fields.map((field) => {
        if (!field || field.hidden) return null;
        const effectiveField =
          inheritedReadonly && !field.readonly
            ? { ...field, readonly: true, __inheritedReadonly: true }
            : field;
        const currentFieldName = parentName
          ? `${parentName}.${effectiveField.name}`
          : effectiveField.name;
        const currentFieldKey = keyPrefix
          ? `${keyPrefix}.${effectiveField.name}`
          : currentFieldName;

        if (
          effectiveField.list === true ||
          (typeof effectiveField.list === "object" &&
            effectiveField.list !== null)
        ) {
          return (
            <ListField
              key={currentFieldKey}
              field={effectiveField}
              fieldName={currentFieldName}
              renderFields={renderFields}
              registerBeforeSubmitHook={registerBeforeSubmitHook}
              runBeforeSubmitHooks={runBeforeSubmitHooks}
            />
          );
        }
        return (
          <SingleField
            key={currentFieldKey}
            field={effectiveField}
            fieldName={currentFieldName}
            keyPrefix={currentFieldKey}
            renderFields={renderFields}
            registerBeforeSubmitHook={registerBeforeSubmitHook}
            onChangeRegistered={onChangeRegistered}
          />
        );
      });
    },
    [onChangeRegistered],
  );

  const runBeforeValidationHooks = useCallback(async () => {
    const hooks = Array.from(beforeSubmitHooksRef.current.values());
    for (const hook of hooks) {
      await hook();
    }
  }, []);

  const handleSubmit = useCallback(
    async (values: Record<string, unknown>) => {
      const latestValues = form.getValues() as Record<string, unknown>;
      await onSubmit(latestValues);
    },
    [form, onSubmit],
  );

  const handleError = () => {
    toast.error(t("Please fix the errors before saving."), { duration: 5000 });
  };

  const handleFormSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      await runBeforeValidationHooks();
      await form.handleSubmit(handleSubmit, handleError)(event);
    },
    [form, handleSubmit, runBeforeValidationHooks],
  );

  return (
    <Form {...form}>
      <form
        id="entry-form"
        onSubmit={handleFormSubmit}
        className="w-full max-w-screen-md mx-auto grid grid-cols-[minmax(0,1fr)] items-start gap-6"
      >
        {filePath && (
          <div className="space-y-2 overflow-hidden">
            <FormLabel>{t("Filename")}</FormLabel>
            {filePath}
          </div>
        )}
        {renderFields(fields, undefined, registerBeforeSubmitHook, runBeforeValidationHooks)}
      </form>
    </Form>
  );
};

export { EntryForm };
