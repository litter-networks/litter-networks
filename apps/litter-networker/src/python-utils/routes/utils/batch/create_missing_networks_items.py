# Copyright 2025 Litter Networks / Clean and Green Communities CIC
# SPDX-License-Identifier: Apache-2.0

import os

os.environ.setdefault("AWS_PROFILE", "ln")
os.environ.setdefault("AWS_REGION", "eu-west-2")

from routes.utils.info.network_info import get_network_info, get_all_network_ids

from routes.utils.maps.update_proximities import update_proximities
from routes.utils.images.flyer_generate import generate_flyer
from routes.utils.images.qr_generate import generate_qr
from routes.utils.images.logo_generate import generate_logo, ImageStyle

from tqdm import tqdm
import concurrent.futures

def create_missing_networks_items(specific_network="", force_generate=False):
    """
    Generate any missing QR codes, flyer images, and logo images for the given network(s), then update global proximity mappings.
    
    When a specific network uniqueId is provided, only that network and a global "all" group are processed; otherwise all networks and the "all" group are processed. After ensuring assets exist (or are regenerated when requested), proximity information is updated globally.
    
    Args:
        specific_network (str, optional): UniqueId of a single network to process. If empty, all networks are processed. Defaults to "".
        force_generate (bool, optional): If True, existing assets will be regenerated; if False, existing assets will be left intact when possible. Defaults to False.
    """
    
    if specific_network:
        network_ids = [specific_network]
    else:
        network_ids = get_all_network_ids()

    network_ids.append("all")

    # Define the network ID to force-generate for
    force_for_network_id = "norrisgreenlitternetwork" if force_generate else False

    # Define the number of worker threads
    max_workers = 10  # Adjust based on your system's capabilities

    # Ensure QR Codes (needed for flyer images)
    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
        qr_tasks = []
        for network_id in network_ids:
            qr_tasks.append(executor.submit(generate_qr, network_id, True, force_generate))
            qr_tasks.append(executor.submit(generate_qr, network_id, False, force_generate))
        
        for _ in tqdm(concurrent.futures.as_completed(qr_tasks), total=len(qr_tasks), desc="Ensuring QR Codes (needed for flyer images)"):
            pass  # The actual generation is handled by generate_qr

    # Ensure Flyer Images
    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
        flyer_tasks = [executor.submit(generate_flyer, network_id, force_generate) for network_id in network_ids]
        
        for _ in tqdm(concurrent.futures.as_completed(flyer_tasks), total=len(flyer_tasks), desc="Ensuring Flyer Images"):
            pass

    # Define a list of ImageStyles to process
    image_styles = [
        ImageStyle.BANNER_ON_WHITE,
        ImageStyle.BANNER_ON_GREEN,
        ImageStyle.BLACK_AND_WHITE,
        ImageStyle.BLACK_AND_WHITE_VOLUNTEER,
        ImageStyle.GREEN,
        ImageStyle.GREEN_ALPHA,
        ImageStyle.GREEN_ALPHA_VOLUNTEER,
        ImageStyle.WHITE_ALPHA
    ]

    # Ensure Logo Images for each ImageStyle
    for style in tqdm(image_styles, desc="Ensuring Logo Images"):
        with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
            logo_tasks = [executor.submit(generate_logo, network_id, style, force_generate) for network_id in network_ids]
            
            for _ in tqdm(concurrent.futures.as_completed(logo_tasks), total=len(logo_tasks), desc=f"Ensuring {style.name} Logo Images"):
                pass

    # Update proximity info - uses mapping to determine closest N networks to each, thus is always done globally:
    update_proximities()

def main():
    """
    Run generation of missing network assets using default options.
    """
    create_missing_networks_items()


if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser(description="Generate network assets")
    parser.add_argument("--network", "-n", help="Specific network uniqueId to process")
    parser.add_argument("--force", "-f", action="store_true", help="Force regeneration")
    args = parser.parse_args()
    create_missing_networks_items(args.network or "", args.force)
