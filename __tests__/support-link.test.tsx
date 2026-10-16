import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import * as Linking from "expo-linking";

import { showDialog } from "@/ui/Dialog";
import { SupportLink } from "@/ui/SupportLink";

jest.mock("expo-linking", () => ({ openURL: jest.fn() }));
jest.mock("@/config", () => ({ SUPPORT_URL: "https://agrograinhub.bg/support" }));
jest.mock("@/ui/Dialog", () => ({ showDialog: jest.fn() }));

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(Linking.openURL).mockResolvedValue(true);
});

it("opens the public support form from the profile row", async () => {
  await render(<SupportLink />);
  await fireEvent.press(screen.getByRole("button", {
    name: "Помощ и поддръжка, Изпрати проблем или запитване",
  }));
  expect(Linking.openURL).toHaveBeenCalledWith("https://agrograinhub.bg/support");
  expect(showDialog).not.toHaveBeenCalled();
});

it("logs browser opening failures and offers the support email", async () => {
  const error = new Error("Browser unavailable");
  jest.mocked(Linking.openURL).mockRejectedValueOnce(error);
  const log = jest.spyOn(console, "error").mockImplementation(() => {});
  try {
    await render(<SupportLink />);
    await fireEvent.press(screen.getByText("Помощ и поддръжка"));
    await waitFor(() => expect(showDialog).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringContaining("info@agrograinhub.com"),
    })));
    expect(log).toHaveBeenCalledWith("Opening support page failed", error);
  } finally {
    log.mockRestore();
  }
});
