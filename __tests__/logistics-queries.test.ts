import { api } from "@/api/client";
import { useLogistics, useLogisticsFacility, useLogisticsMap } from "@/api/queries";
import { logisticsListSchema, logisticsMapSchema, logisticsPublicFacilitySchema } from "@/api/schemas";

const mockUseQuery = jest.fn();
jest.mock("@tanstack/react-query", () => ({
  useQuery: (options: unknown) => { mockUseQuery(options); return options; },
}));
jest.mock("@/api/client", () => ({ api: jest.fn() }));
type Options = {
  queryKey: unknown[]; enabled?: boolean; meta: { persist: boolean }; refetchInterval: number;
  queryFn: (context: { signal: AbortSignal }) => Promise<unknown>;
};
const options = () => mockUseQuery.mock.calls.at(-1)[0] as Options;
beforeEach(() => jest.clearAllMocks());

it("fetches the correct page using the shared list schema and bearer-enabled API client", async () => {
  useLogistics("city=TEST%20town", 2);
  const signal = new AbortController().signal;
  await options().queryFn({ signal });
  expect(api).toHaveBeenCalledWith("/logistics/facilities?city=TEST%20town&page=2", { schema: logisticsListSchema, signal });
  expect(options().meta.persist).toBe(false);
  expect(options().refetchInterval).toBe(60000);
});
it("does not fetch a paginated list while the overview map is open", () => {
  useLogistics("", 1, false);
  expect(options().enabled).toBe(false);
  useLogistics("", 1);
  expect(options().enabled).toBe(true);
});
it("encodes facility identifiers and disables an absent selection", async () => {
  useLogisticsFacility(null);
  expect(options().enabled).toBe(false);
  useLogisticsFacility("TEST / id");
  const signal = new AbortController().signal;
  await options().queryFn({ signal });
  expect(api).toHaveBeenCalledWith("/logistics/facilities/TEST%20%2F%20id", { schema: logisticsPublicFacilitySchema, signal });
});
it("fetches map data independently of pagination with the same filters and a bbox", async () => {
  useLogisticsMap("load=true", "20,40,29,45");
  const signal = new AbortController().signal;
  await options().queryFn({ signal });
  expect(api).toHaveBeenCalledWith("/logistics/map?load=true&bbox=20,40,29,45", { schema: logisticsMapSchema, signal });
  expect(options().queryKey).toEqual(["logistics", "map", "load=true", "20,40,29,45"]);
  expect(options().meta.persist).toBe(false);
});
it("does not request maps before bounds/provider readiness", () => {
  useLogisticsMap("", null);
  expect(options().enabled).toBe(false);
  useLogisticsMap("", "20,40,29,45", false);
  expect(options().enabled).toBe(false);
});
