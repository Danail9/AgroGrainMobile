import { isApiError } from "@/api/client";
import { useToggleSaved } from "@/api/queries";
import { showDialog } from "@/ui/Dialog";
import { Button } from "@/ui/forms";

/** Bookmarks an offer or listing; the saver is notified when it changes. */
export function SaveButton({
  kind,
  id,
  saved,
}: {
  kind: "OFFER" | "LISTING";
  id: string;
  saved: boolean;
}) {
  const toggle = useToggleSaved();
  // Shows the requested state while the request is in flight.
  const value = toggle.isPending && toggle.variables ? toggle.variables.saved : saved;

  return (
    <Button
      title={value ? "Запазено" : kind === "OFFER" ? "Запази офертата" : "Запази обявата"}
      icon={value ? "bookmark" : "bookmark-outline"}
      variant="secondary"
      disabled={toggle.isPending}
      onPress={() => {
        toggle.mutate(
          { kind, id, saved: !value },
          {
            onError: (e) => {
              showDialog({
                title: "Не успяхме да запазим",
                message: isApiError(e) ? e.message : "Опитай отново.",
                tone: "danger",
                icon: "alert-circle-outline",
              });
            },
          },
        );
      }}
    />
  );
}
