import React, {useCallback, useMemo, useRef} from 'react';
import type {View} from 'react-native';
import type {OnyxEntry} from 'react-native-onyx';
// Use the original useOnyx hook to get the real-time data from Onyx and not from the snapshot
// eslint-disable-next-line no-restricted-imports
import {useOnyx as originalUseOnyx} from 'react-native-onyx';
import {getButtonRole} from '@components/Button/utils';
import OfflineWithFeedback from '@components/OfflineWithFeedback';
import PressableWithFeedback from '@components/Pressable/PressableWithFeedback';
import {useSearchContext} from '@components/Search/SearchContext';
import type {ListItem, TransactionListItemProps, TransactionListItemType} from '@components/SelectionListWithSections/types';
import TransactionItemRow from '@components/TransactionItemRow';
import useAnimatedHighlightStyle from '@hooks/useAnimatedHighlightStyle';
import useCurrentUserPersonalDetails from '@hooks/useCurrentUserPersonalDetails';
import useOnyx from '@hooks/useOnyx';
import useResponsiveLayout from '@hooks/useResponsiveLayout';
import useStyleUtils from '@hooks/useStyleUtils';
import useSyncFocus from '@hooks/useSyncFocus';
import useTheme from '@hooks/useTheme';
import useThemeStyles from '@hooks/useThemeStyles';
import type {TransactionPreviewData} from '@libs/actions/Search';
import {handleActionButtonPress as handleActionButtonPressUtil} from '@libs/actions/Search';
import getNonEmptyStringOnyxID from '@libs/getNonEmptyStringOnyxID';
import {isViolationDismissed, shouldShowViolation} from '@libs/TransactionUtils';
import variables from '@styles/variables';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import {isActionLoadingSelector} from '@src/selectors/ReportMetaData';
import type {Policy, Report, ReportAction, ReportActions} from '@src/types/onyx';
import type {TransactionViolation} from '@src/types/onyx/TransactionViolation';
import UserInfoAndActionButtonRow from './UserInfoAndActionButtonRow';

function TransactionListItem<TItem extends ListItem>({
    item,
    isFocused,
    showTooltip,
    isDisabled,
    canSelectMultiple,
    onSelectRow,
    onCheckboxPress,
    onFocus,
    onLongPressRow,
    shouldSyncFocus,
    columns,
    isLoading,
    areAllOptionalColumnsHidden,
    violations,
    onDEWModalOpen,
}: TransactionListItemProps<TItem>) {
    const transactionItem = item as unknown as TransactionListItemType;
    const styles = useThemeStyles();
    const theme = useTheme();

    const {isLargeScreenWidth, shouldUseNarrowLayout} = useResponsiveLayout();
    const {currentSearchHash, currentSearchKey} = useSearchContext();
    const [snapshot] = useOnyx(`${ONYXKEYS.COLLECTION.SNAPSHOT}${currentSearchHash}`, {canBeMissing: true});
    const snapshotReport = useMemo(() => {
        return (snapshot?.data?.[`${ONYXKEYS.COLLECTION.REPORT}${transactionItem.reportID}`] ?? {}) as Report;
    }, [snapshot, transactionItem.reportID]);

    const [isActionLoading] = useOnyx(`${ONYXKEYS.COLLECTION.REPORT_METADATA}${transactionItem.reportID}`, {canBeMissing: true, selector: isActionLoadingSelector});

    const snapshotPolicy = useMemo(() => {
        return (snapshot?.data?.[`${ONYXKEYS.COLLECTION.POLICY}${transactionItem.policyID}`] ?? {}) as Policy;
    }, [snapshot, transactionItem.policyID]);
    const [lastPaymentMethod] = useOnyx(`${ONYXKEYS.NVP_LAST_PAYMENT_METHOD}`, {canBeMissing: true});

    const [parentReport] = originalUseOnyx(`${ONYXKEYS.COLLECTION.REPORT}${getNonEmptyStringOnyxID(transactionItem.reportID)}`, {canBeMissing: true});
    const [transaction] = originalUseOnyx(`${ONYXKEYS.COLLECTION.TRANSACTION}${transactionItem.transactionID}`, {canBeMissing: true});
    
    // Fetch the fresh IOU report action from the current report, not from the stale search snapshot
    // This is important after moving transactions to a new report
    const parentReportActionSelector = useCallback(
        (reportActions: OnyxEntry<ReportActions>): OnyxEntry<ReportAction> => {
            // First try to find by the moneyRequestReportActionID from the snapshot
            const actionByID = reportActions?.[`${transactionItem?.moneyRequestReportActionID}`];
            if (actionByID) {
                return actionByID;
            }
            
            // If not found, search for the IOU action by transaction ID
            // This handles the case where the transaction was moved to a new report
            const actions = Object.values(reportActions ?? {});
            return actions.find((action) => {
                const originalMessage = action?.originalMessage as {IOUTransactionID?: string};
                return originalMessage?.IOUTransactionID === transactionItem.transactionID;
            });
        },
        [transactionItem?.moneyRequestReportActionID, transactionItem.transactionID],
    );
    const [parentReportAction] = originalUseOnyx(
        `${ONYXKEYS.COLLECTION.REPORT_ACTIONS}${getNonEmptyStringOnyxID(transactionItem.reportID)}`,
        {selector: parentReportActionSelector, canBeMissing: true},
        [transactionItem],
    );
    
    // Use the fresh childReportID from the parent report action, not from the stale snapshot
    const childReportID = parentReportAction?.childReportID ?? transactionItem?.reportAction?.childReportID;
    const [transactionThreadReport] = originalUseOnyx(`${ONYXKEYS.COLLECTION.REPORT}${childReportID}`, {canBeMissing: true});
    const currentUserDetails = useCurrentUserPersonalDetails();
    const transactionPreviewData: TransactionPreviewData = useMemo(
        () => ({hasParentReport: !!parentReport, hasTransaction: !!transaction, hasParentReportAction: !!parentReportAction, hasTransactionThreadReport: !!transactionThreadReport}),
        [parentReport, transaction, parentReportAction, transactionThreadReport],
    );

    const pressableStyle = [
        styles.transactionListItemStyle,
        !isLargeScreenWidth && styles.pt3,
        item.isSelected && styles.activeComponentBG,
        isLargeScreenWidth ? {...styles.flexRow, ...styles.justifyContentBetween, ...styles.alignItemsCenter} : {...styles.flexColumn, ...styles.alignItemsStretch},
    ];

    const animatedHighlightStyle = useAnimatedHighlightStyle({
        borderRadius: variables.componentBorderRadius,
        shouldHighlight: item?.shouldAnimateInHighlight ?? false,
        highlightColor: theme.messageHighlightBG,
        backgroundColor: theme.highlightBG,
    });

    const {amountColumnSize, dateColumnSize, taxAmountColumnSize} = useMemo(() => {
        return {
            amountColumnSize: transactionItem.isAmountColumnWide ? CONST.SEARCH.TABLE_COLUMN_SIZES.WIDE : CONST.SEARCH.TABLE_COLUMN_SIZES.NORMAL,
            taxAmountColumnSize: transactionItem.isTaxAmountColumnWide ? CONST.SEARCH.TABLE_COLUMN_SIZES.WIDE : CONST.SEARCH.TABLE_COLUMN_SIZES.NORMAL,
            dateColumnSize: transactionItem.shouldShowYear ? CONST.SEARCH.TABLE_COLUMN_SIZES.WIDE : CONST.SEARCH.TABLE_COLUMN_SIZES.NORMAL,
        };
    }, [transactionItem.isAmountColumnWide, transactionItem.isTaxAmountColumnWide, transactionItem.shouldShowYear]);

    const transactionViolations = useMemo(() => {
        return (violations?.[`${ONYXKEYS.COLLECTION.TRANSACTION_VIOLATIONS}${transactionItem.transactionID}`] ?? []).filter(
            (violation: TransactionViolation) =>
                !isViolationDismissed(transactionItem, violation, currentUserDetails.email ?? '', currentUserDetails.accountID, snapshotReport, snapshotPolicy) &&
                shouldShowViolation(snapshotReport, snapshotPolicy, violation.name, currentUserDetails.email ?? '', false),
        );
    }, [snapshotPolicy, snapshotReport, transactionItem, violations, currentUserDetails.email, currentUserDetails.accountID]);

    const handleActionButtonPress = useCallback(() => {
        // Create an updated transaction item with FRESH data from Onyx
        // This ensures we use the correct IOU action ID and child report ID after moving transactions
        const updatedTransactionItem: TransactionListItemType = {
            ...transactionItem,
            // Use the fresh moneyRequestReportActionID from the parent report action
            // This is critical to prevent duplicate actions when the transaction was moved
            moneyRequestReportActionID: parentReportAction?.reportActionID ?? transactionItem.moneyRequestReportActionID,
            reportAction: transactionItem.reportAction ? {
                ...transactionItem.reportAction,
                childReportID,
            } : undefined,
        } as TransactionListItemType;
        
        handleActionButtonPressUtil(
            currentSearchHash,
            updatedTransactionItem,
            () => onSelectRow(item, transactionPreviewData),
            snapshotReport,
            snapshotPolicy,
            lastPaymentMethod,
            currentSearchKey,
            onDEWModalOpen,
        );
    }, [currentSearchHash, transactionItem, parentReportAction?.reportActionID, childReportID, transactionPreviewData, snapshotReport, snapshotPolicy, lastPaymentMethod, currentSearchKey, onSelectRow, item, onDEWModalOpen]);

    const handleCheckboxPress = useCallback(() => {
        onCheckboxPress?.(item);
    }, [item, onCheckboxPress]);

    const onPress = useCallback(() => {
        // Create an updated item with FRESH data from Onyx
        // This ensures we use the correct IOU action ID and child report ID after moving transactions
        const updatedItem = {
            ...item,
            // Use the fresh moneyRequestReportActionID from the parent report action
            // This is critical to prevent duplicate actions when the transaction was moved
            moneyRequestReportActionID: parentReportAction?.reportActionID ?? transactionItem.moneyRequestReportActionID,
            reportAction: {
                ...transactionItem.reportAction,
                childReportID,
            },
        } as TItem;
        
        onSelectRow(updatedItem, transactionPreviewData);
    }, [item, parentReportAction?.reportActionID, transactionItem.reportAction, transactionItem.moneyRequestReportActionID, childReportID, onSelectRow, transactionPreviewData]);

    const onLongPress = useCallback(() => {
        onLongPressRow?.(item);
    }, [item, onLongPressRow]);

    const StyleUtils = useStyleUtils();
    const pressableRef = useRef<View>(null);

    useSyncFocus(pressableRef, !!isFocused, shouldSyncFocus);

    return (
        <OfflineWithFeedback pendingAction={item.pendingAction}>
            <PressableWithFeedback
                ref={pressableRef}
                onLongPress={onLongPress}
                onPress={onPress}
                disabled={isDisabled && !item.isSelected}
                accessibilityLabel={item.text ?? ''}
                role={getButtonRole(true)}
                isNested
                onMouseDown={(e) => e.preventDefault()}
                hoverStyle={[!item.isDisabled && styles.hoveredComponentBG, item.isSelected && styles.activeComponentBG]}
                dataSet={{[CONST.SELECTION_SCRAPER_HIDDEN_ELEMENT]: true, [CONST.INNER_BOX_SHADOW_ELEMENT]: false}}
                id={item.keyForList ?? ''}
                style={[
                    pressableStyle,
                    isFocused && StyleUtils.getItemBackgroundColorStyle(!!item.isSelected, !!isFocused, !!item.isDisabled, theme.activeComponentBG, theme.hoverComponentBG),
                ]}
                onFocus={onFocus}
                wrapperStyle={[styles.mb2, styles.mh5, styles.flex1, animatedHighlightStyle, styles.userSelectNone]}
            >
                {!isLargeScreenWidth && (
                    <UserInfoAndActionButtonRow
                        item={transactionItem}
                        handleActionButtonPress={handleActionButtonPress}
                        shouldShowUserInfo={!!transactionItem?.from}
                        isInMobileSelectionMode={shouldUseNarrowLayout && !!canSelectMultiple}
                    />
                )}
                <TransactionItemRow
                    transactionItem={transactionItem}
                    report={transactionItem.report}
                    shouldShowTooltip={showTooltip}
                    onButtonPress={handleActionButtonPress}
                    onCheckboxPress={handleCheckboxPress}
                    shouldUseNarrowLayout={!isLargeScreenWidth}
                    columns={columns}
                    isActionLoading={isLoading ?? isActionLoading}
                    isSelected={!!transactionItem.isSelected}
                    dateColumnSize={dateColumnSize}
                    amountColumnSize={amountColumnSize}
                    taxAmountColumnSize={taxAmountColumnSize}
                    shouldShowCheckbox={!!canSelectMultiple}
                    style={[styles.p3, styles.pv2, shouldUseNarrowLayout ? styles.pt2 : {}, isLargeScreenWidth && styles.pr0]}
                    areAllOptionalColumnsHidden={areAllOptionalColumnsHidden}
                    violations={transactionViolations}
                    onArrowRightPress={onPress}
                />
            </PressableWithFeedback>
        </OfflineWithFeedback>
    );
}

TransactionListItem.displayName = 'TransactionListItem';

export default TransactionListItem;
