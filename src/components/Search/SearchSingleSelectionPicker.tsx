import React, {useEffect, useState} from 'react';
import SingleSelectListItem from '@components/SelectionList/ListItem/SingleSelectListItem';
import SelectionListWithSections from '@components/SelectionList/SelectionListWithSections';
import useDebouncedState from '@hooks/useDebouncedState';
import useLocalize from '@hooks/useLocalize';
import Navigation from '@libs/Navigation/Navigation';
import type {OptionData} from '@libs/ReportUtils';
import {sortOptionsWithEmptyValue} from '@libs/SearchQueryUtils';
import ROUTES from '@src/ROUTES';
import type {Route} from '@src/ROUTES';
import SearchFilterPageFooterButtons from './SearchFilterPageFooterButtons';

type SearchSingleSelectionPickerItem = {
    name: string;
    value: string;
};

type SearchSingleSelectionPickerProps = {
    items: SearchSingleSelectionPickerItem[];
    initiallySelectedItem: SearchSingleSelectionPickerItem | undefined;
    pickerTitle?: string;
    onSaveSelection: (value: string | undefined) => void;
    backToRoute?: Route;
    pinnedTopItems?: SearchSingleSelectionPickerItem[];
    shouldAutoSave?: boolean;
    shouldShowTextInput?: boolean;
};

function SearchSingleSelectionPicker({
    items,
    initiallySelectedItem,
    pickerTitle,
    onSaveSelection,
    backToRoute,
    shouldAutoSave,
    pinnedTopItems,
    shouldShowTextInput = true,
}: SearchSingleSelectionPickerProps) {
    const {translate, localeCompare} = useLocalize();

    const [searchTerm, debouncedSearchTerm, setSearchTerm] = useDebouncedState('');
    const [selectedItem, setSelectedItem] = useState<SearchSingleSelectionPickerItem | undefined>(initiallySelectedItem);

    useEffect(() => {
        setSelectedItem(initiallySelectedItem);
    }, [initiallySelectedItem]);

    const pinnedTopSection = (pinnedTopItems ?? [])
        .filter((item) => item.name.toLowerCase().includes(debouncedSearchTerm?.toLowerCase()))
        .map((item) => ({
            text: item.name,
            keyForList: item.value,
            isSelected: selectedItem?.value === item.value,
            value: item.value,
        }));
    const isPinnedTopItem = (pinnedTopItems ?? []).some((p) => p.value === initiallySelectedItem?.value);

    const initiallySelectedItemSection =
        !isPinnedTopItem && initiallySelectedItem?.name.toLowerCase().includes(debouncedSearchTerm?.toLowerCase())
            ? [
                  {
                      text: initiallySelectedItem.name,
                      keyForList: initiallySelectedItem.value,
                      isSelected: selectedItem?.value === initiallySelectedItem.value,
                      value: initiallySelectedItem.value,
                  },
              ]
            : [];

    const remainingItemsSection = items
        .filter(
            (item) =>
                item.value !== initiallySelectedItem?.value &&
                !(pinnedTopItems ?? []).some((p) => p.value === item.value) &&
                item.name.toLowerCase().includes(debouncedSearchTerm?.toLowerCase()),
        )
        .sort((a, b) => sortOptionsWithEmptyValue(a.name.toString(), b.name.toString(), localeCompare))
        .map((item) => ({
            text: item.name,
            keyForList: item.value,
            isSelected: selectedItem?.value === item.value,
            value: item.value,
        }));

    const noResultsFound = !pinnedTopSection.length && !initiallySelectedItemSection.length && !remainingItemsSection.length;

    const sections = noResultsFound
        ? []
        : [
              {
                  title: undefined,
                  data: pinnedTopSection,
                  sectionIndex: 0,
              },

              {
                  title: undefined,
                  data: initiallySelectedItemSection,
                  sectionIndex: 1,
              },
              {
                  title: pickerTitle,
                  data: remainingItemsSection,
                  sectionIndex: 2,
              },
          ];

    const onSelectItem = (item: Partial<OptionData & SearchSingleSelectionPickerItem>) => {
        if (!item.text || item.keyForList === undefined || item.keyForList === null || item.value === undefined || item.value === null) {
            return;
        }
        if (shouldAutoSave) {
            onSaveSelection(item.isSelected ? '' : item.value);
            Navigation.goBack(backToRoute ?? ROUTES.SEARCH_ADVANCED_FILTERS.getRoute());
            return;
        }
        if (!item.isSelected) {
            setSelectedItem({name: item.text, value: item.value});
        }
    };

    const resetChanges = () => {
        setSelectedItem(undefined);
    };

    const applyChanges = () => {
        onSaveSelection(selectedItem?.value);
        Navigation.goBack(backToRoute ?? ROUTES.SEARCH_ADVANCED_FILTERS.getRoute());
    };

    const footerContent = (
        <SearchFilterPageFooterButtons
            applyChanges={applyChanges}
            resetChanges={resetChanges}
        />
    );

    const textInputOptions = {
        value: searchTerm,
        label: translate('common.search'),
        onChangeText: setSearchTerm,
        headerMessage: noResultsFound ? translate('common.noResultsFound') : undefined,
    };

    return (
        <SelectionListWithSections
            sections={sections}
            onSelectRow={onSelectItem}
            ListItem={SingleSelectListItem}
            initiallyFocusedItemKey={initiallySelectedItem?.value}
            shouldShowTextInput={shouldShowTextInput}
            textInputOptions={textInputOptions}
            footerContent={shouldAutoSave ? undefined : footerContent}
            shouldShowLoadingPlaceholder={!noResultsFound}
            shouldUpdateFocusedIndex
            shouldStopPropagation
        />
    );
}

export default SearchSingleSelectionPicker;
export type {SearchSingleSelectionPickerItem};
