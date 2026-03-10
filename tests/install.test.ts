import { describe, it, expect } from "vitest";
import { generateInfoPlist } from "../src/commands/install.js";

describe("generateInfoPlist", () => {
  it("embeds SNIP_BIN with the detected path as fallback", () => {
    const plist = generateInfoPlist("/opt/homebrew/bin/snip", 20);

    // Each script must set up SNIP_BIN using := assignment so the user can
    // override it via Alfred's Workflow Environment Variables.
    // The content is XML-escaped in the plist, so quotes become &quot;
    expect(plist).toContain(": &quot;${SNIP_BIN:=/opt/homebrew/bin/snip}&quot;");
  });

  it("uses $SNIP_BIN (not the bare path) to invoke snip", () => {
    const plist = generateInfoPlist("/usr/local/bin/snip", 10);

    // The scripts must invoke "$SNIP_BIN" (XML-escaped as &quot;$SNIP_BIN&quot;)
    // rather than the raw path so the env-var override actually takes effect.
    expect(plist).toContain("&quot;$SNIP_BIN&quot;");
    // The raw path should only appear inside the fallback, not as a bare invocation
    expect(plist).not.toMatch(/>[^<]*\/usr\/local\/bin\/snip\s/);
  });

  it("respects the maxResults parameter", () => {
    const plist = generateInfoPlist("/usr/bin/snip", 42);
    expect(plist).toContain("-n 42");
  });

  it("produces valid XML with the bundle ID", () => {
    const plist = generateInfoPlist("/usr/bin/snip", 20);
    expect(plist).toContain("com.jtsternberg.snip-search");
    expect(plist).toMatch(/^<\?xml/);
    expect(plist).toContain("</plist>");
  });

  it("includes all required Alfred workflow object types", () => {
    const plist = generateInfoPlist("/usr/bin/snip", 20);
    // These are the Alfred workflow object types used in the plist.
    // Wrong version numbers for these cause "incompatible workflow" errors.
    expect(plist).toContain("alfred.workflow.input.scriptfilter");
    expect(plist).toContain("alfred.workflow.action.revealfile");
    expect(plist).toContain("alfred.workflow.output.clipboard");
    expect(plist).toContain("alfred.workflow.trigger.universalaction");
    expect(plist).toContain("alfred.workflow.input.keyword");
    expect(plist).toContain("alfred.workflow.output.notification");
  });

  it("includes all required top-level plist keys", () => {
    const plist = generateInfoPlist("/usr/bin/snip", 20);
    expect(plist).toContain("<key>disabled</key>");
    expect(plist).toContain("<key>userconfigurationconfig</key>");
    expect(plist).toContain("<key>connections</key>");
    expect(plist).toContain("<key>objects</key>");
  });

  it("handles snip paths with spaces safely", () => {
    const plist = generateInfoPlist("/Users/John Smith/bin/snip", 20);
    // The path must appear inside a quoted ${SNIP_BIN:=...} assignment
    expect(plist).toContain(": &quot;${SNIP_BIN:=/Users/John Smith/bin/snip}&quot;");
    // And the invocation must always use quoted "$SNIP_BIN"
    expect(plist).toContain("&quot;$SNIP_BIN&quot;");
  });
});
