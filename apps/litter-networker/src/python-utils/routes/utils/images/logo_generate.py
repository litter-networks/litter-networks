# Copyright 2025 Litter Networks / Clean and Green Communities CIC
# SPDX-License-Identifier: Apache-2.0

from PIL import Image, ImageDraw, ImageFont
import os
from enum import Enum, auto
from routes.utils.info.network_info import get_network_info, get_all_network_ids
from routes.utils.images.image_utils import save_image_to_s3, image_exists_on_s3

# Enum for image styles
class ImageStyle(Enum):
    BANNER_ON_WHITE = auto()
    BANNER_ON_GREEN = auto()
    BLACK_AND_WHITE = auto()
    BLACK_AND_WHITE_VOLUNTEER = auto()
    GREEN = auto()
    GREEN_ALPHA = auto()
    GREEN_ALPHA_VOLUNTEER = auto()
    WHITE_ALPHA = auto() 

# Function to generate the image and upload it to S3
def generate_logo(net, image_style=ImageStyle.BANNER_ON_WHITE, force_generate=False):

    # Determine the base directory where the script is located
    """
    Generate and upload a styled network logo and a thumbnail to S3.
    
    Creates a full-size PNG and a thumbnail PNG for the given network ID using the specified ImageStyle, rendering the network display name (from `logoName` or `fullName`, split on "|" into separate lines), a centered "litternetworks.org" URL line, and an optional "Volunteer" label for volunteer styles. If both output files already exist on S3 and `force_generate` is False, the function returns without modifying remote assets. The final images are uploaded to S3 at paths of the form `proc/images/resources/logo/logo-{net}{extra_tokens}.png` and `...-thumb.png`.
    
    Parameters:
        net (str): Network identifier used to look up display name and to name output files.
        image_style (ImageStyle): Visual style to apply (controls template, colors, scaling, and whether a "Volunteer" label is included).
        force_generate (bool): If True, regenerate and upload images even if they already exist on S3; if False, skip generation when both files are present.
    """
    base_dir = os.path.dirname(os.path.abspath(__file__))

    # General settings
    text_colour = (155, 187, 60)
    font_path = os.path.join(base_dir, 'fonts', 'calibri.ttf')
    font_path_bold = os.path.join(base_dir, 'fonts', 'calibrib.ttf')
    font_size = 95
    url_text_size = 46
    volunteer_font_size = 160
    text_y = 700
    text_y_bw = 1780
    text_sep_y = 100
    extra_text_sep_y_url = 0
    extra_text_sep_y_url_2lines = 20
    scale_all = 1.0
    crop_width = 750
    banner_text_y = 640

    # generate output file-paths...

    extra_tokens = ""

    if image_style == ImageStyle.BLACK_AND_WHITE:
        extra_tokens += "-bw"
        text_colour = (0, 0, 0)
    elif image_style == ImageStyle.BLACK_AND_WHITE_VOLUNTEER:
        extra_tokens += "-bwv"
        text_colour = (0, 0, 0)
    elif image_style == ImageStyle.GREEN_ALPHA:
        extra_tokens += "-ga"
    elif image_style == ImageStyle.GREEN:
        extra_tokens += "-g"
    elif image_style == ImageStyle.GREEN_ALPHA_VOLUNTEER:
        extra_tokens += "-gav"
    elif image_style == ImageStyle.WHITE_ALPHA:
        extra_tokens += "-wa"
        text_colour = (0, 0, 0)
    elif image_style == ImageStyle.BANNER_ON_WHITE:
        text_y = banner_text_y
    elif image_style == ImageStyle.BANNER_ON_GREEN:
        extra_tokens += "-bnr-g"
        text_y = banner_text_y
        text_colour = (255, 255, 255)
    
    logo_path = f'proc/images/resources/logo/logo-{net}{extra_tokens}.png'
    logo_thumb_path = f'proc/images/resources/logo/logo-{net}{extra_tokens}-thumb.png'

    # ... and see if they already exist on s3:
    if force_generate is False:
        if image_exists_on_s3(logo_path) and image_exists_on_s3(logo_thumb_path):
            return

    # Mocked network name, replace with actual logic to fetch based on 'net'
    network_info = get_network_info(net);
    selected_network_logo_name = network_info.get("logoName") or network_info.get("fullName")
    
    # Split network-name into lines (delimited by "|")
    lines = selected_network_logo_name.split("|")
    
    # load taller image if more than 1 line
    image_path = "logo_long_template_2.png" if len(lines) > 1 else "logo_long_template.png"

    if image_style == ImageStyle.BLACK_AND_WHITE or image_style == ImageStyle.WHITE_ALPHA:
        image_path = "logo_blackwhitealpha_2line.png" if len(lines) > 1 else "logo_blackwhitealpha_1line.png"
    elif image_style == ImageStyle.BLACK_AND_WHITE_VOLUNTEER:
        image_path = "logo_blackwhitealpha_volunteer.png"
    elif image_style == ImageStyle.GREEN_ALPHA:
        image_path = "logo_greenalpha_2line.png" if len(lines) > 1 else "logo_greenalpha_1line.png"
    elif image_style == image_style == ImageStyle.GREEN:
        image_path = "logo_green_2line.png" if len(lines) > 1 else "logo_green_1line.png"
    elif image_style == ImageStyle.GREEN_ALPHA_VOLUNTEER:
        image_path = "logo_greenalpha_volunteer.png"
    elif image_style == image_style == ImageStyle.BANNER_ON_GREEN:
        image_path = "logo_bannerongreen_2line.png" if len(lines) > 1 else "logo_bannerongreen_1line.png"
    
    # Load the image
    image = Image.open(os.path.join(base_dir, 'source', image_path)).convert("RGBA")
    draw = ImageDraw.Draw(image)
    
    # Get image dimensions
    image_width, image_height = image.size
    
    # If scaling needed, adjust font sizes
    if image_style in (ImageStyle.BLACK_AND_WHITE, ImageStyle.BLACK_AND_WHITE_VOLUNTEER, ImageStyle.WHITE_ALPHA,
                       ImageStyle.GREEN, ImageStyle.GREEN_ALPHA, ImageStyle.GREEN_ALPHA_VOLUNTEER):
        scale_all = image_width / crop_width
        font_size = int(font_size * scale_all)
        text_y = text_y_bw
        text_sep_y = int(text_sep_y * scale_all)
        extra_text_sep_y_url = int(extra_text_sep_y_url * scale_all)
        url_text_size = int(url_text_size * scale_all)

    # Load the font
    font = ImageFont.truetype(font_path, font_size)
    
    # Draw the lines of text
    for line in lines:
        text_bbox = draw.textbbox((0, 0), line, font=font)
        text_width = text_bbox[2] - text_bbox[0]
        text_height = text_bbox[3] - text_bbox[1]
        line_x = (image_width / 2) - (text_width / 2)
        draw.text((line_x, text_y), line, fill=text_colour, font=font)
        text_y += text_sep_y
    
    # Draw URL text
    extra_text_sep_y_url = extra_text_sep_y_url_2lines if len(lines) > 1 else extra_text_sep_y_url
    url_font = ImageFont.truetype(font_path, url_text_size)
    url_text = "litternetworks.org"
    text_bbox = draw.textbbox((0, 0), url_text, font=url_font)
    text_width = text_bbox[2] - text_bbox[0]
    text_height = text_bbox[3] - text_bbox[1]
    line_x = (image_width / 2) - (text_width / 2)
    draw.text((line_x, text_y + extra_text_sep_y_url), url_text, fill=text_colour, font=url_font)

    # Draw volunteer text if required
    if image_style in (ImageStyle.BLACK_AND_WHITE_VOLUNTEER, ImageStyle.GREEN_ALPHA_VOLUNTEER):
        font_bold = ImageFont.truetype(font_path_bold, int(volunteer_font_size * scale_all))
        volunteer_text = "Volunteer"
        text_bbox = draw.textbbox((0, 0), volunteer_text, font=font_bold)
        text_width = text_bbox[2] - text_bbox[0]
        text_height = text_bbox[3] - text_bbox[1]
        line_x = (image_width / 2) - (text_width / 2)

        extra_text_sep_y_vol = 340 if len(lines) > 1 else 380

        draw.text((line_x, text_y + extra_text_sep_y_vol), volunteer_text, fill=text_colour, font=font_bold)

        if len(lines) < 2:
            image_height -= 350
            image = image.crop((0, 0, image_width, image_height))

    if image_style == ImageStyle.WHITE_ALPHA:
        # Separate alpha channel
        r, g, b, a = image.split()
        # Invert RGB channels
        rgb_image = Image.merge("RGB", (r, g, b))
        inverted_rgb = Image.eval(rgb_image, lambda x: 255 - x)
        # Merge back with alpha
        image = Image.merge("RGBA", (*inverted_rgb.split(), a))
    
    # generate thumbnail version:
    image_thumb = image.resize((int(image_width / 5), int(image_height / 5)), Image.Resampling.LANCZOS)

    # Save images to S3 using prepared paths
    save_image_to_s3(image, logo_path)
    save_image_to_s3(image_thumb, logo_thumb_path)

def main():

    """
    Generate logo images for networks in all predefined styles and upload them to S3.
    
    When run in single-file mode (isSingleFileMode = True) this generates logos only for the hard-coded network "anfieldlitter". In the default mode it retrieves all network IDs via get_all_network_ids(), iterates them with a tqdm progress bar, and calls generate_logo for each network for the following ImageStyle values: BANNER_ON_WHITE, BANNER_ON_GREEN, BLACK_AND_WHITE, BLACK_AND_WHITE_VOLUNTEER, GREEN, GREEN_ALPHA, GREEN_ALPHA_VOLUNTEER, and WHITE_ALPHA. The local flags isSingleFileMode and isForceGenerate (both False by default) control single-network processing and whether generation is forced even if outputs already exist.
    """
    isSingleFileMode = False
    isForceGenerate = False

    if isSingleFileMode:
        generate_logo(net="anfieldlitter", image_style=ImageStyle.BANNER_ON_WHITE, force_generate=isForceGenerate)
    else:
        # Fetch all uniqueIds from the table
        unique_ids = get_all_network_ids()

        from tqdm import tqdm
        
        # Loop over each uniqueId and perform the desired action
        for unique_id in tqdm(unique_ids, desc="Processing Logo Images"):
            generate_logo(net=unique_id, image_style=ImageStyle.BANNER_ON_WHITE, force_generate=isForceGenerate)
            generate_logo(net=unique_id, image_style=ImageStyle.BANNER_ON_GREEN, force_generate=isForceGenerate)
            generate_logo(net=unique_id, image_style=ImageStyle.BLACK_AND_WHITE, force_generate=isForceGenerate)
            generate_logo(net=unique_id, image_style=ImageStyle.BLACK_AND_WHITE_VOLUNTEER, force_generate=isForceGenerate)
            generate_logo(net=unique_id, image_style=ImageStyle.GREEN, force_generate=isForceGenerate)
            generate_logo(net=unique_id, image_style=ImageStyle.GREEN_ALPHA, force_generate=isForceGenerate)
            generate_logo(net=unique_id, image_style=ImageStyle.GREEN_ALPHA_VOLUNTEER, force_generate=isForceGenerate)
            generate_logo(net=unique_id, image_style=ImageStyle.WHITE_ALPHA, force_generate=isForceGenerate)

if __name__ == '__main__':
    main()
