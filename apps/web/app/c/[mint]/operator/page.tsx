import { HyphaeAdminError } from "@hyphae/admin-client/source";
import { cookies, headers } from "next/headers.js";
import { notFound } from "next/navigation.js";
import {
  OperatorDisabled,
  OperatorForbidden,
  OperatorSetupView,
  OperatorShell,
  OperatorSignedOut,
  OperatorUnavailable,
  OperatorView,
  type PublishAvailability,
} from "../../../../components/operator-view.js";
import { OPERATOR_COOKIE, operatorClient, operatorToken } from "../../../../lib/operator-server.js";
import { readCommunity } from "../../../../lib/reads.js";

export const dynamic = "force-dynamic";
export const metadata = { title: "Operator", robots: { index: false, follow: false } };

const code = (error: unknown) => (error instanceof HyphaeAdminError ? error.code : "unavailable");

export default async function OperatorPage(props: { params: Promise<{ mint: string }> }) {
  const { mint } = await props.params;
  if (!/^[A-Za-z0-9]{1,64}$/.test(mint)) notFound();
  const result = await readCommunity(mint);
  if (!result.ok) return result.reason === "not_found" ? notFound() : <OperatorUnavailable />;
  if (result.data.mint !== mint) return <OperatorUnavailable />;
  const shell = (body: React.ReactNode) => (
    <OperatorShell name={result.data.name} mint={mint}>
      {body}
    </OperatorShell>
  );
  const cookie = (await cookies()).get(OPERATOR_COOKIE)?.value ?? null;
  const token = cookie ? operatorToken(`${OPERATOR_COOKIE}=${cookie}`) : null;
  const visitor = process.env.VERCEL === "1" ? (await headers()).get("x-real-ip") : null;
  const client = operatorClient(token, visitor);
  if (!client) return shell(<OperatorUnavailable />);
  // The API is the one switch: off answers "disabled", and the page loads no wallet code. An
  // API without the operator routes (an older image) answers not_found: that is off too.
  try {
    await client.status();
  } catch (error) {
    const off = code(error) === "disabled" || code(error) === "not_found";
    return shell(off ? <OperatorDisabled /> : <OperatorUnavailable />);
  }
  if (!token) return shell(<OperatorSignedOut mint={mint} />);
  // Part B's routes: off (disabled, or an API image without them) and down are told apart.
  const publishOf = async (): Promise<PublishAvailability> => {
    try {
      await client.publishStatus(mint);
      return "on";
    } catch (error) {
      return code(error) === "disabled" || code(error) === "not_found" ? "off" : "unavailable";
    }
  };
  try {
    const session = await client.session();
    if (session.mint !== mint) return shell(<OperatorForbidden />);
    if (session.role === "setup")
      return shell(<OperatorSetupView session={session} publish={await publishOf()} />);
    const [overview, publish] = await Promise.all([client.overview(mint), publishOf()]);
    return shell(<OperatorView overview={overview} session={session} publish={publish} />);
  } catch (error) {
    const c = code(error);
    if (c === "unauthorized") return shell(<OperatorSignedOut mint={mint} expired />);
    if (c === "forbidden") return shell(<OperatorForbidden />);
    if (c === "disabled") return shell(<OperatorDisabled />);
    return shell(<OperatorUnavailable />);
  }
}
