// Copyright Clean and Green Communities CIC / Litter Networks
// SPDX-License-Identifier: Apache-2.0

import type { MouseEvent, ReactNode } from 'react';
import { useMemo } from 'react';
import { appEnv } from '@/config/env';
import { useNavData } from '@/features/nav/useNavData';
import { usePageTitle } from '@/shared/hooks/usePageTitle';
import styles from './styles/join-in-resources.module.css';

interface ResourceContext {
  networkSlug: string;
  shortCode: string;
}

interface ResourceBlockData {
  id: string;
  header: string;
  imagePath: string;
  imageSuffix?: string;
  thumbnailSuffix?: string;
  darkBackground?: boolean;
  buildMainText: (context: ResourceContext) => ReactNode;
  block1: ResourceTextSection;
  block2: ResourceTextSection;
}

interface ResourceTextSection {
  title: string;
  steps: (context: ResourceContext) => ReactNode[];
}

const imageDownloadInstructions: ReactNode[] = [
  <>
    <b>Desktop</b>: Right-click on this section &gt; Save Link As…
  </>,
  <>
    <b>Touch</b>: Hold your finger on this section &gt; Download link
  </>,
];

const RESOURCE_BLOCKS: ResourceBlockData[] = [
  {
    id: 'poster',
    header: 'Promotional Poster or Flyer',
    imagePath: '/proc/images/resources/flyer/flyer-',
    thumbnailSuffix: '-thumb',
    buildMainText: () => (
      <>
        This <b>print-resolution</b> resource (2473×3500px) can be used in any print or digital media. It contains lots of
        useful information, and gives a flavour of what we are all about, so is ideal for <b>promoting your Litter Network</b>!
      </>
    ),
    block1: {
      title: 'How to download it ?',
      steps: () => imageDownloadInstructions,
    },
    block2: {
      title: 'Some ideas on using it !',
      steps: () => [
        <>Post it to Facebook or other Social Media to help promote your Litter Network <b>digitally</b> online!</>,
        <>Print it as an A2 or A3 <b>poster</b> for hanging in shops and other public spaces!</>,
        <>Print it as an A5 or A6 <b>flyer</b> for handing out or as a smaller alternative to posters!</>,
      ],
    },
  },
  {
    id: 'qr-code',
    header: 'QR Code and Short URL',
    imagePath: '/proc/images/resources/qr/qr-',
    buildMainText: ({ shortCode }) => (
      <>
        This QR code (300×300px) can be used in any print or digital media where a white-background to the code is useful. When
        scanned it takes you to the handy short url: <b>litternetworks.org/{shortCode}</b>
      </>
    ),
    block1: {
      title: 'How to download it ?',
      steps: () => imageDownloadInstructions,
    },
    block2: {
      title: 'Some ideas on using it !',
      steps: () => [
        <>Add it to a bespoke poster or flyer! (check out our poster below which uses it!)</>,
        <>Add it to a business card for your network!</>,
      ],
    },
  },
  {
    id: 'qr-code-nobg',
    header: 'QR Code - No Background',
    imagePath: '/proc/images/resources/qr/qr-',
    imageSuffix: '-nobg',
    buildMainText: () => (
      <>
        This QR code (300×300px) can be used in any print or digital media. When scanned it also takes you to the same handy
        short url as above.
      </>
    ),
    block1: {
      title: 'How to download it ?',
      steps: () => imageDownloadInstructions,
    },
    block2: {
      title: 'Some ideas on using it !',
      steps: () => [
        <>Print it onto hivis vests! (better with no background so the yellow vest shows through!)</>,
        <>Add it to a bespoke poster or flyer!</>,
        <>Add it to a business card for your network!</>,
      ],
    },
  },
  {
    id: 'logo-banner-green',
    header: 'Green Logo Banner - Screen Resolution',
    imagePath: '/proc/images/resources/logo/logo-',
    imageSuffix: '-bnr-g',
    thumbnailSuffix: '-thumb',
    buildMainText: () => (
      <>
        This <b>screen-resolution</b> resource (2000×1000px) can be used in any digital media where lots of{' '}
        <b>green padding</b> around a lower-resolution logo is useful.
      </>
    ),
    block1: {
      title: 'How to download it ?',
      steps: () => imageDownloadInstructions,
    },
    block2: {
      title: 'Some ideas on using it !',
      steps: () => [<>As a <b>banner</b> for your Litter Networks&apos;s online Facebook group!</>],
    },
  },
  {
    id: 'logo-banner-white',
    header: 'White Logo Banner - Screen Resolution',
    imagePath: '/proc/images/resources/logo/logo-',
    thumbnailSuffix: '-thumb',
    buildMainText: () => (
      <>
        This <b>screen-resolution</b> resource (2000×1000px) can be used in any digital media where lots of{' '}
        <b>white padding</b> around a lower-resolution logo is useful.
      </>
    ),
    block1: {
      title: 'How to download it ?',
      steps: () => imageDownloadInstructions,
    },
    block2: {
      title: 'Some ideas on using it !',
      steps: () => [<>As an alternative <b>banner</b> for your Litter Networks&apos;s online Facebook group!</>],
    },
  },
  {
    id: 'logo-green-screen',
    header: 'Green Logo - Screen Resolution',
    imagePath: '/proc/images/resources/logo/logo-',
    imageSuffix: '-g-thumb',
    buildMainText: () => (
      <>
        This <b>screen-resolution</b> resource (600×600px) can be used in any digital media where small file-size is more
        important than image-quality, and a transparent background is desired.
      </>
    ),
    block1: {
      title: 'How to download it ?',
      steps: () => imageDownloadInstructions,
    },
    block2: {
      title: 'Some ideas on using it !',
      steps: () => [<>Logo for your <b>chat group</b>! (remember to also post your picks and updates to Facebook!)</>],
    },
  },
  {
    id: 'logo-black-print',
    header: 'Black Logo - Print Resolution',
    imagePath: '/proc/images/resources/logo/logo-',
    imageSuffix: '-bw',
    thumbnailSuffix: '-thumb',
    buildMainText: () => (
      <>
        This <b>print-resolution</b> resource (3000×2680px) can be used in any print or digital media. It has a transparent
        background and so would work well in a wide range of contexts in which black text and imagery is useful!
      </>
    ),
    block1: {
      title: 'How to download it ?',
      steps: () => imageDownloadInstructions,
    },
    block2: {
      title: 'Some ideas on using it !',
      steps: () => [<>A smaller logo on the <b>front of a hi-vis vest</b>!</>],
    },
  },
  {
    id: 'logo-black-volunteer',
    header: "Black 'Volunteer' Logo - Print Resolution",
    imagePath: '/proc/images/resources/logo/logo-',
    imageSuffix: '-bwv',
    thumbnailSuffix: '-thumb',
    buildMainText: () => (
      <>
        This <b>print-resolution</b> resource (3000×3150px) can be used in any print or digital media. The word{' '}
        <b>Volunteer</b> is included to publicise this really inspiring and important fact!
      </>
    ),
    block1: {
      title: 'How to download it ?',
      steps: () => imageDownloadInstructions,
    },
    block2: {
      title: 'Some ideas on using it !',
      steps: () => [<>A large logo to wear with pride on the <b>back of a hi-vis vest</b>!</>],
    },
  },
  {
    id: 'logo-white-print',
    header: 'White Logo - Print Resolution',
    imagePath: '/proc/images/resources/logo/logo-',
    imageSuffix: '-wa',
    thumbnailSuffix: '-thumb',
    darkBackground: true,
    buildMainText: () => (
      <>
        This <b>print-resolution</b> resource (3000×2680px) can be used in any print or digital media. It has a transparent
        background and so would work well in contexts where white text and imagery is useful!
      </>
    ),
    block1: {
      title: 'How to download it ?',
      steps: () => imageDownloadInstructions,
    },
    block2: {
      title: 'Some ideas on using it !',
      steps: () => [
        <>As a source-asset for your own posters or flyers - check out our use of it on the poster / flyer above!</>,
      ],
    },
  },
  {
    id: 'logo-green-print',
    header: 'Green Logo - Print Resolution',
    imagePath: '/proc/images/resources/logo/logo-',
    imageSuffix: '-ga',
    thumbnailSuffix: '-thumb',
    buildMainText: () => (
      <>
        This <b>print-resolution</b> resource (3000×2680px) can be used in any print or digital media. It has a transparent
        background and so would work well in contexts where our traditional green text and imagery is useful!
      </>
    ),
    block1: {
      title: 'How to download it ?',
      steps: () => imageDownloadInstructions,
    },
    block2: {
      title: 'Some ideas on using it !',
      steps: () => [<>As a source-asset for your own designs!</>],
    },
  },
  {
    id: 'logo-green-volunteer',
    header: "Green 'Volunteer' Logo - Print Resolution",
    imagePath: '/proc/images/resources/logo/logo-',
    imageSuffix: '-gav',
    thumbnailSuffix: '-thumb',
    buildMainText: () => (
      <>
        This <b>print-resolution</b> resource (3000×3150px) can be used in any print or digital media. It has a transparent
        background and so would work well in contexts where our traditional green text and imagery is useful!
      </>
    ),
    block1: {
      title: 'How to download it ?',
      steps: () => imageDownloadInstructions,
    },
    block2: {
      title: 'Some ideas on using it !',
      steps: () => [<>As a source-asset for your own designs!</>],
    },
  },
];

/**
 * Render the "Join In | Resources" page, showing downloadable resource cards tailored to the current network.
 *
 * Derives a network context from navigation data, sets the page title, conditionally shows an important note
 * when no network is selected, and renders the list of resource blocks.
 *
 * @returns The page element containing the title, optional important note, and resource cards.
 */
export function JoinInResourcesPage() {
  const { network } = useNavData();
  usePageTitle('Join In | Resources');
  const context = useMemo<ResourceContext>(
    () => ({
      networkSlug: network?.uniqueId ?? 'all',
      shortCode: network?.shortId ?? network?.uniqueId ?? 'all',
    }),
    [network?.uniqueId, network?.shortId],
  );

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>
        Join In | <b>Resources</b>
      </h1>
      {!network && <ImportantNote />}
      <div className={styles.resourcesList}>
        {RESOURCE_BLOCKS.map((block) => (
          <ResourceBlock key={block.id} block={block} context={context} />
        ))}
      </div>
    </div>
  );
}

/**
 * Render a clickable resource card that links to the downloadable image and displays a preview, main text, and two sub-sections.
 *
 * @param block - Metadata and render callbacks for the resource (header, image paths, text builders, and styling flags)
 * @param context - Context used to build image URLs and render dynamic text (e.g., networkSlug and shortCode)
 * @returns A JSX element representing the resource card with preview image, descriptive text, and sub-blocks
 */
function ResourceBlock({ block, context }: { block: ResourceBlockData; context: ResourceContext }) {
  const downloadUrl = buildImageUrl(block, context, false);
  const previewUrl = buildImageUrl(block, context, true);

  const preventContextMenu = (event: MouseEvent<HTMLImageElement>) => {
    event.preventDefault();
  };

  return (
    <a className={styles.resourceLink} href={downloadUrl} target="_blank" rel="noopener noreferrer">
      <div className={styles.resourceCard}>
        <div className={styles.resourceHeader}>
          <div className={styles.resourceHeaderTitle}>{block.header}</div>
        </div>
        <div className={styles.resourceBody}>
          <div className={styles.landscape}>
            <img
              src={previewUrl}
              alt=""
              loading="lazy"
              className={`${styles.resourceImage} ${block.darkBackground ? styles.resourceImageDark : ''}`}
              onContextMenu={preventContextMenu}
            />
            <div className={styles.textContainer}>
              <div className={styles.mainText}>{block.buildMainText(context)}</div>
              <div className={styles.subBlocks}>
                <ResourceTextBlock title={block.block1.title} steps={block.block1.steps(context)} />
                <ResourceTextBlock title={block.block2.title} steps={block.block2.steps(context)} />
              </div>
            </div>
          </div>
          <div className={styles.portrait}>
            <img
              src={previewUrl}
              alt=""
              loading="lazy"
              className={`${styles.resourceImage} ${block.darkBackground ? styles.resourceImageDark : ''}`}
              onContextMenu={preventContextMenu}
            />
            <div className={styles.mainText}>{block.buildMainText(context)}</div>
            <div className={styles.subBlocks}>
              <ResourceTextBlock title={block.block1.title} steps={block.block1.steps(context)} portrait />
              <ResourceTextBlock title={block.block2.title} steps={block.block2.steps(context)} portrait />
            </div>
          </div>
        </div>
      </div>
    </a>
  );
}

/**
 * Render a titled text block containing a list of step items, with an optional portrait layout.
 *
 * @param title - The header text displayed above the list of steps.
 * @param steps - An array of React nodes rendered as the block's list items, in order.
 * @param portrait - When `true`, applies portrait-specific styling to the title and list.
 * @returns The JSX element for the titled steps block.
 */
function ResourceTextBlock({
  title,
  steps,
  portrait,
}: {
  title: string;
  steps: ReactNode[];
  portrait?: boolean;
}) {
  return (
    <div className={styles.subBlock}>
      <p className={portrait ? styles.blockTitlePortrait : styles.blockTitle}>{title}</p>
      <ul className={portrait ? styles.listPortrait : styles.list}>
        {steps.map((step, index) => (
          <li key={index}>{step}</li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Renders an informational notice about permitted uses of the page's resources and when to contact the organisation.
 *
 * The notice explains that resources labelled for specific Litter Networks may be used freely to promote a positive image,
 * while generic Litter Networks materials imply representation of the organisation and should be preceded by an email to
 * contact@litternetworks.org describing the intended use. Also clarifies that hi‑vis printing for litter picks is allowed
 * without prior contact.
 *
 * @returns A JSX notice card containing the guidance text and a mailto link to contact@litternetworks.org
 */
function ImportantNote() {
  return (
    <div className={styles.noticeCard}>
      <div className={styles.noticeHeader}>Important Note</div>
      <div className={styles.noticeBody}>
        You&apos;re welcome to use resources from <b>specific Litter Networks</b> (e.g. Anfield Litter Network) for any
        purpose that promotes a <b>positive image of your network</b>, and that helps build <b>strong, friendly partnerships</b> with everyone! No need to ask us first.
        <br />
        <br />
        The <b>generic Litter Networks resources</b> on this page come with the added <b>responsibility</b> of implying
        that you are in some way <b>representing Litter Networks</b> as an organisation, so we kindly request that you{' '}
        <b>
          <a className={styles.noticeLink} href="mailto:contact@litternetworks.org">
            drop us an email
          </a>
        </b>{' '}
        describing, and ideally illustrating, your use-case - to confirm it fits in with the image we need to project.
        <br />
        <br />
        Although if it&apos;s just for <b>hi-vis printing</b> for litter picks, please go for it - no need to ask!! 😊
      </div>
    </div>
  );
}

/**
 * Build the absolute URL for a block's image (preview or full download) for a given network context.
 *
 * @param block - Resource block metadata containing imagePath and optional suffixes
 * @param context - ResourceContext providing the networkSlug to select the network-specific image
 * @param useThumbnail - If `true`, append the block's thumbnailSuffix (if any) to request a thumbnail variant
 * @returns The composed PNG image URL from the static assets base, block path, network slug, and applicable suffixes
 */
function buildImageUrl(block: ResourceBlockData, context: ResourceContext, useThumbnail: boolean) {
  const suffix = block.imageSuffix ?? '';
  const thumb = useThumbnail ? block.thumbnailSuffix ?? '' : '';
  return `${appEnv.staticAssetsBaseUrl}${block.imagePath}${context.networkSlug}${suffix}${thumb}.png`;
}
