import React, {useEffect, useCallback} from 'react';
import {useOnyx} from 'react-native-onyx';
import DelegateNoAccessWrapper from '@components/DelegateNoAccessWrapper';
import ScreenWrapper from '@components/ScreenWrapper';
import useInitial from '@hooks/useInitial';
import type {PlatformStackScreenProps} from '@libs/Navigation/PlatformStackNavigation/types';
import type {SettingsNavigatorParamList} from '@navigation/types';
import PlaidConnectionStep from '@pages/workspace/companyCards/addNew/PlaidConnectionStep';
import BankConnection from '@pages/workspace/companyCards/BankConnection';
import type {WithPolicyAndFullscreenLoadingProps} from '@pages/workspace/withPolicyAndFullscreenLoading';
import withPolicyAndFullscreenLoading from '@pages/workspace/withPolicyAndFullscreenLoading';
import {clearAssignCardStepAndData, setAssignCardStepAndData} from '@userActions/CompanyCards';
import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type SCREENS from '@src/SCREENS';
import type {CompanyCardFeed} from '@src/types/onyx';
import AssigneeStep from './AssigneeStep';
import CardNameStep from './CardNameStep';
import CardSelectionStep from './CardSelectionStep';
import ConfirmationStep from './ConfirmationStep';
import TransactionStartDateStep from './TransactionStartDateStep';

type AssignCardFeedPageProps = PlatformStackScreenProps<SettingsNavigatorParamList, typeof SCREENS.WORKSPACE.COMPANY_CARDS_ASSIGN_CARD> & WithPolicyAndFullscreenLoadingProps;

// Define step order for navigation
const STEP_ORDER = [
    CONST.COMPANY_CARD.STEP.ASSIGNEE,
    CONST.COMPANY_CARD.STEP.BANK_CONNECTION,
    CONST.COMPANY_CARD.STEP.PLAID_CONNECTION,
    CONST.COMPANY_CARD.STEP.CARD,
    CONST.COMPANY_CARD.STEP.TRANSACTION_START_DATE,
    CONST.COMPANY_CARD.STEP.CARD_NAME,
    CONST.COMPANY_CARD.STEP.CONFIRMATION,
];

function AssignCardFeedPage({route, policy, navigation}: AssignCardFeedPageProps) {
    const [assignCard] = useOnyx(ONYXKEYS.ASSIGN_CARD, {canBeMissing: true});
    
    const feed = decodeURIComponent(route.params?.feed) as CompanyCardFeed;
    const backTo = route.params?.backTo;
    const urlStep = route.params?.step;
    const policyID = policy?.id;
    
    // Determine current step: URL takes precedence, then Onyx state, then default
    const currentStep = urlStep || assignCard?.currentStep || CONST.COMPANY_CARD.STEP.ASSIGNEE;
    
    const [isActingAsDelegate] = useOnyx(ONYXKEYS.ACCOUNT, {selector: (account) => !!account?.delegatedAccess?.delegate, canBeMissing: true});
    const firstAssigneeEmail = useInitial(assignCard?.data?.email);
    const shouldUseBackToParam = !firstAssigneeEmail || firstAssigneeEmail === assignCard?.data?.email;

    // Navigation helpers
    const navigateToStep = useCallback((step: string) => {
        // Update URL parameters
        navigation.setParams({ step });
        
        // Update Onyx state to keep them in sync
        setAssignCardStepAndData({currentStep: step, isEditing:false});
    }, [navigation]);

    const navigateToPreviousStep = useCallback(() => {
        const currentIndex = STEP_ORDER.indexOf(currentStep);
        if (currentIndex > 0) {
            const previousStep = STEP_ORDER[currentIndex - 1];
            navigateToStep(previousStep);
        } else {
            // If we're at the first step, close the modal
            navigation.goBack();
        }
    }, [currentStep, navigateToStep, navigation]);

    const navigateToNextStep = useCallback((nextStep: string) => {
        navigateToStep(nextStep);
    }, [navigateToStep]);

    // Handle browser back button
    useEffect(() => {
        const unsubscribe = navigation.addListener('beforeRemove', (e) => {
            // If we're at the first step, allow normal back behavior (close modal)
            if (currentStep === CONST.COMPANY_CARD.STEP.ASSIGNEE) {
                return;
            }
            
            // Prevent default behavior (closing modal)
            e.preventDefault();
            
            // Navigate to previous step instead
            navigateToPreviousStep();
        });

        return unsubscribe;
    }, [navigation, currentStep, navigateToPreviousStep]);

    // Sync URL with Onyx state on mount
    useEffect(() => {
        if (urlStep && urlStep !== assignCard?.currentStep) {
            setAssignCardStepAndData({currentStep: urlStep, isEditing: false});
        } else if (!urlStep && assignCard?.currentStep) {
            navigation.setParams({ step: assignCard.currentStep });
        }
    }, [urlStep, assignCard?.currentStep, navigation]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            clearAssignCardStepAndData();
        };
    }, []);

    if (isActingAsDelegate) {
        return (
            <ScreenWrapper
                testID={AssignCardFeedPage.displayName}
                enableEdgeToEdgeBottomSafeAreaPadding
                shouldEnablePickerAvoiding={false}
            >
                <DelegateNoAccessWrapper accessDeniedVariants={[CONST.DELEGATE.DENIED_ACCESS_VARIANTS.DELEGATE]} />
            </ScreenWrapper>
        );
    }

    // Pass navigation helpers to child components
    const commonProps = {
        onNext: navigateToNextStep,
        onBack: navigateToPreviousStep,
        onClose: () => navigation.goBack(),
    };

    switch (currentStep) {
        case CONST.COMPANY_CARD.STEP.BANK_CONNECTION:
            return (
                <BankConnection
                    policyID={policyID}
                    feed={feed}
                    {...commonProps}
                />
            );
        case CONST.COMPANY_CARD.STEP.PLAID_CONNECTION:
            return (
                <PlaidConnectionStep 
                    feed={feed} 
                    {...commonProps}
                />
            );
        case CONST.COMPANY_CARD.STEP.ASSIGNEE:
            return (
                <AssigneeStep
                    policy={policy}
                    feed={feed}
                    {...commonProps}
                />
            );
        case CONST.COMPANY_CARD.STEP.CARD:
            return (
                <CardSelectionStep
                    feed={feed}
                    policyID={policyID}
                    {...commonProps}
                />
            );
        case CONST.COMPANY_CARD.STEP.TRANSACTION_START_DATE:
            return (
                <TransactionStartDateStep
                    policyID={policyID}
                    feed={feed}
                    backTo={backTo}
                    {...commonProps}
                />
            );
        case CONST.COMPANY_CARD.STEP.CARD_NAME:
            return (
                <CardNameStep 
                    policyID={policyID} 
                    {...commonProps}
                />
            );
        case CONST.COMPANY_CARD.STEP.CONFIRMATION:
            return (
                <ConfirmationStep
                    policyID={policyID}
                    backTo={shouldUseBackToParam ? backTo : undefined}
                    {...commonProps}
                />
            );
        default:
            return (
                <AssigneeStep
                    policy={policy}
                    feed={feed}
                    {...commonProps}
                />
            );
    }
}

AssignCardFeedPage.displayName = 'AssignCardFeedPage';
export default withPolicyAndFullscreenLoading(AssignCardFeedPage);