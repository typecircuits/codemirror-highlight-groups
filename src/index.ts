import { Decoration, EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";
import { RangeSet, StateEffect, StateField } from "@codemirror/state";
import { nanoid } from "nanoid/non-secure";

export interface Group {
    ranges: GroupRange[];
}

export interface GroupRange {
    start: number;
    end: number;
    primary?: boolean;
    underlined?: boolean;
}

export const setHighlightGroups = StateEffect.define<Record<string, Group>>();

export const setHighlightedGroup = StateEffect.define<string | undefined>();

interface State {
    groups: Record<string, Group>;
    highlightedGroup: string | undefined;
}

const initialState: State = {
    groups: {},
    highlightedGroup: undefined,
};

const state = StateField.define<State>({
    create: () => initialState,
    update: (value, transaction) => {
        for (const effect of transaction.effects) {
            if (effect.is(setHighlightGroups)) {
                value = { ...value, groups: effect.value };
            }

            if (effect.is(setHighlightedGroup)) {
                value = { ...value, highlightedGroup: effect.value };
            }
        }

        return value;
    },
});

export const highlightGroups = (options: {
    groupClassName: string;
    onmouseover?: (element: HTMLElement, groupId: string, range: GroupRange) => void;
    onmouseout?: (element: HTMLElement, groupId: string, range: GroupRange) => void;
}) => [
    state,
    ViewPlugin.fromClass(
        class {
            view: EditorView;
            state: State;
            decorations: RangeSet<Decoration> = RangeSet.empty;

            constructor(view: EditorView) {
                this.view = view;
                this.state = view.state.field(state);
                this.updateDecorations();
                this.updateHighlighted();
            }

            update(update: ViewUpdate) {
                const prevState = this.state;
                this.state = update.state.field(state);

                if (prevState.groups !== this.state.groups) {
                    this.updateDecorations();
                }

                if (prevState.highlightedGroup !== this.state.highlightedGroup) {
                    this.updateHighlighted();
                }
            }

            updateDecorations() {
                const decorations = Object.entries(this.state.groups).flatMap(([id, group]) =>
                    group.ranges.flatMap((range) => {
                        const decorationId = nanoid();

                        const attributes: Record<string, string> = {
                            "data-group-decoration-id": decorationId,
                            "data-group-id": id,
                        };

                        if (range.primary) {
                            attributes["data-group-primary"] = "true";
                            attributes["data-group-highlighted"] = "true";
                        }

                        if (range.underlined) {
                            attributes["data-group-underlined"] = "true";
                        }

                        const decoration = Decoration.mark({
                            class: options.groupClassName,
                            attributes,
                            inclusive: true,
                        });

                        requestAnimationFrame(() => {
                            const element = document.querySelector(
                                `[data-group-decoration-id="${decorationId}"]`,
                            ) as HTMLElement;

                            if (element == null) return;

                            element.addEventListener("mouseover", (e) => {
                                e.stopPropagation();

                                this.view.dispatch({ effects: setHighlightedGroup.of(id) });
                                options.onmouseover?.(element, id, range);
                            });

                            element.addEventListener("mouseout", (e) => {
                                e.stopPropagation();

                                this.view.dispatch({ effects: setHighlightedGroup.of(undefined) });
                                options.onmouseout?.(element, id, range);
                            });
                        });

                        return decoration.range(range.start, range.end);
                    }),
                );

                this.decorations = RangeSet.of(decorations, true);
            }

            updateHighlighted() {
                const allMarkGroupDecorations = this.view.contentDOM.querySelectorAll<HTMLElement>(
                    `[data-group-decoration-id]`,
                );

                if (this.state.highlightedGroup != null) {
                    allMarkGroupDecorations.forEach((element) => {
                        delete element.dataset.groupHighlighted;
                        delete element.dataset.groupDimmed;

                        if (element.dataset.groupId === this.state.highlightedGroup) {
                            element.dataset.groupHighlighted = "true";
                        } else {
                            element.dataset.groupDimmed = "true";
                        }
                    });
                } else {
                    allMarkGroupDecorations.forEach((element) => {
                        if ("groupPrimary" in element.dataset) {
                            element.dataset.groupHighlighted = "true";
                            delete element.dataset.groupDimmed;
                        } else {
                            element.dataset.groupDimmed = "true";
                            delete element.dataset.groupHighlighted;
                        }
                    });
                }
            }
        },
        {
            decorations: (plugin) => plugin.decorations,
        },
    ),
];
