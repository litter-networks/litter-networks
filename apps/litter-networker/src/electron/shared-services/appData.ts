// Copyright Clean and Green Communities CIC / Litter Networks
// SPDX-License-Identifier: Apache-2.0

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { fromIni } from "@aws-sdk/credential-providers";
import type { AppSnapshot, BagSummary, NetworkInfo, PaneLayout } from "../../shared/app-state";

const AWS_REGION = process.env.AWS_REGION ?? "eu-west-2";
const AWS_PROFILE = process.env.AWS_PROFILE ?? "ln";

const documentClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({
    region: AWS_REGION,
    credentials: fromIni({ profile: AWS_PROFILE })
  })
);
const HOME_NETWORK_ID = "litternetworks";

// Optional mock base: when set, Facebook URLs point to the local mock server.
const getFacebookBaseUrl = () => process.env.MOCK_FACEBOOK_BASE_URL;
const buildFacebookUrl = (networkId: string) => {
  const base = getFacebookBaseUrl();
  if (base) {
    return `${base}/mock/${networkId}`;
  }
  return `https://www.facebook.com/groups/${networkId}?sorting_setting=CHRONOLOGICAL`;
};
const buildHomeFacebookUrl = () => {
  const base = getFacebookBaseUrl();
  if (base) {
    return `${base}/mock/${HOME_NETWORK_ID}`;
  }
  return "https://www.facebook.com/litternetworks";
};

const tabs: AppSnapshot["tabs"] = [
  { id: "browse", label: "Browse" },
  { id: "networks", label: "Networks" },
  { id: "tables", label: "Tables" },
  { id: "content", label: "Content" },
  { id: "costs", label: "Costs" }
];

type NetworkRecord = {
  uniqueId: string;
  districtId: string;
  fullName: string;
  region?: string;
};

type DistrictRecord = {
  uniqueId: string;
  fullName: string;
  region?: string;
};

type BagCountRecord = {
  uniqueId: string;
  thisYear?: number;
  mostRecentPost?: string;
};

const scanTable = async <T>(tableName: string): Promise<T[]> => {
  const items: T[] = [];
  let ExclusiveStartKey: Record<string, any> | undefined;

  do {
    try {
      const response = await documentClient.send(
        new ScanCommand({
          TableName: tableName,
          ExclusiveStartKey
        })
      );

      if (response.Items) {
        items.push(...(response.Items as T[]));
      }

      ExclusiveStartKey = response.LastEvaluatedKey;
    } catch (error: any) {
      const baseMessage = error?.message ?? error?.toString() ?? "Unknown AWS error";
      throw new Error(
        `Unable to scan DynamoDB table "${tableName}" (profile=${AWS_PROFILE}, region=${AWS_REGION}). Details: ${baseMessage}`
      );
    }
  } while (ExclusiveStartKey);

  return items;
};

const buildNetworks = async (): Promise<{ networks: NetworkInfo[]; defaultNetworkId: string }> => {
  const [networkRows, districtRows] = await Promise.all([
    scanTable<NetworkRecord>("LN-NetworksInfo"),
    scanTable<DistrictRecord>("LN-DistrictsInfo")
  ]);

  networkRows.sort((a, b) => a.fullName.localeCompare(b.fullName, undefined, { sensitivity: "base" }));

  const districts = new Map(districtRows.map((district) => [district.uniqueId, district]));
  const totalCount = networkRows.length;

  const formattedNetworks: NetworkInfo[] = networkRows.map((network, index) => {
    const districtKey = network.districtId.split(",")[0];
    const district = districts.get(districtKey);
    const districtName = district?.fullName ?? districtKey ?? "";
    const region = district?.region ?? network.region ?? "";
    const displayLabel = `${index + 1}/${totalCount} - ${network.fullName} - ${districtName}`;

    return {
      id: network.uniqueId,
      name: network.fullName,
      districtId: districtKey,
      districtName,
      region,
      displayLabel,
      facebookGroupUrl: buildFacebookUrl(network.uniqueId)
    };
  });

  const homeNetwork: NetworkInfo = {
    id: HOME_NETWORK_ID,
    name: "Home",
    districtId: "",
    districtName: "",
    region: "",
    displayLabel: "Home",
    facebookGroupUrl: buildHomeFacebookUrl()
  };

  return {
    networks: [homeNetwork, ...formattedNetworks],
    defaultNetworkId: HOME_NETWORK_ID
  };
};

const formatMostRecent = (value?: string) => {
  if (!value) {
    return undefined;
  }
  const match = value.match(/(\d{2})\.(\d{2})\.(\d{2}) (\d{2}):(\d{2})/);
  if (!match) {
    return value;
  }
  const [, day, month, year, hour, minute] = match;
  const parsedDate = new Date(
    Number(`20${year}`),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute)
  );
  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }
  return parsedDate.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
};

const buildBagSummaries = async (networks: NetworkInfo[]): Promise<BagSummary[]> => {
  const rows = await scanTable<BagCountRecord>("LN-BagCounts");
  const overall = rows.find((row) => row.uniqueId === "all");
  const overallCount = Number(overall?.thisYear ?? 0);

  const summaries: BagSummary[] = networks
    .filter((network) => network.id !== HOME_NETWORK_ID)
    .map((network) => {
      const entry = rows.find((row) => row.uniqueId === network.id);
      return {
        networkId: network.id,
        totals: {
          all: overallCount,
          session: Number(entry?.thisYear ?? 0),
          lastUpdated: formatMostRecent(entry?.mostRecentPost)
        }
      };
    });

  if (overall) {
    summaries.push({
      networkId: "all",
      totals: {
        all: overallCount,
        session: overallCount,
        lastUpdated: formatMostRecent(overall.mostRecentPost)
      }
    });
  }

  return summaries;
};

const paneLayout: PaneLayout = {
  left: { id: "facebook", title: "Facebook Triage", url: "https://www.facebook.com" },
  right: { id: "ln-admin", title: "LitterNetworks Admin", url: "https://litternetworks.org" }
};

const buildFallbackSnapshot = (): AppSnapshot => ({
  networks: [
    {
      id: HOME_NETWORK_ID,
      name: "Home",
      districtId: "",
      districtName: "",
      region: "",
      displayLabel: "Home",
      facebookGroupUrl: buildHomeFacebookUrl()
    },
    {
      id: "demo-network",
      name: "Demo Network",
      districtId: "demo-district",
      districtName: "Demo District",
      region: "Demo Region",
      displayLabel: "1/1 - Demo District > Demo Network",
      facebookGroupUrl: buildFacebookUrl("litternetworks")
    }
  ],
  bagSummaries: [
    {
      networkId: "demo-network",
      totals: { all: 0, session: 0, lastUpdated: undefined }
    },
    {
      networkId: "all",
      totals: { all: 0, session: 0, lastUpdated: undefined }
    }
  ],
  defaultNetworkId: HOME_NETWORK_ID,
  paneLayout,
  tabs,
  metadata: {
    profile: AWS_PROFILE,
    region: AWS_REGION,
    error: "Using offline fallback data (AWS tables unavailable)."
  }
});

export const getAppSnapshot = async (): Promise<AppSnapshot> => {
  try {
    const { networks, defaultNetworkId } = await buildNetworks();
    const bagSummaries = await buildBagSummaries(networks);

    return {
      networks,
      bagSummaries,
      defaultNetworkId,
      paneLayout,
      tabs,
      metadata: {
        profile: AWS_PROFILE,
        region: AWS_REGION
      }
    };
  } catch (error: any) {
    const baseMessage = error?.message ?? error?.toString() ?? "Unknown AWS error";
    return {
      ...buildFallbackSnapshot(),
      metadata: {
        profile: AWS_PROFILE,
        region: AWS_REGION,
        error: `Failed to load AWS data (profile=${AWS_PROFILE}, region=${AWS_REGION}). Details: ${baseMessage}`
      }
    };
  }
};
