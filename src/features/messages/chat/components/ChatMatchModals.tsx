import { MatchConfirmationModal, type MatchUserRole } from "@/components/chat/MatchConfirmationModal";
import { MatchDealPickerModal } from "@/components/chat/MatchDealPickerModal";
import { type Conversation } from "@/services/api";

import { type ChatModal } from "../chatTypes";
import { type ChatMatchActionsController } from "../hooks/useChatMatchActions";

interface ChatMatchModalsProps {
  match: ChatMatchActionsController;
  userRole: MatchUserRole;
  conversation: Conversation | null;
  errorFor: (modal: ChatModal) => string | null;
}

/** The match confirmation sheet, and the deal picker it can hand off to. */
export function ChatMatchModals({
  match,
  userRole,
  conversation,
  errorFor,
}: Readonly<ChatMatchModalsProps>) {
  const {
    matchModalOpen,
    setMatchModalOpen,
    matchPending,
    handleAccept,
    matchCandidates,
    setMatchCandidates,
    handlePickDeal,
  } = match;

  return (
    <>
      {/* ───────── Match confirmation modal ───────── */}
      <MatchConfirmationModal
        open={matchModalOpen}
        pending={matchPending}
        userRole={userRole}
        contextType={conversation?.context_type}
        error={errorFor("match")}
        onCancel={() => {
          if (!matchPending) setMatchModalOpen(false);
        }}
        onConfirm={() => void handleAccept()}
      />

      {/* Only opens when the server refused to choose between several deliveries. */}
      <MatchDealPickerModal
        open={!!matchCandidates}
        candidates={matchCandidates ?? []}
        pending={matchPending}
        error={errorFor("dealPicker")}
        onCancel={() => setMatchCandidates(null)}
        onPick={(candidate) => void handlePickDeal(candidate)}
      />
    </>
  );
}
