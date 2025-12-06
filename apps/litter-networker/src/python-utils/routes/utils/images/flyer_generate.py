# Copyright Litter Networks / Clean and Green Communities CIC
# SPDX-License-Identifier: Apache-2.0

import os
from PIL import Image, ImageDraw, ImageFont
from routes.utils.info.network_info import get_network_info, get_all_network_ids
from routes.utils.images.image_utils import save_image_to_s3, load_image_from_s3, image_exists_on_s3

def generate_flyer(net, force_generate=False):
    
    """
    Generate and upload a flyer image and its thumbnail for a network to S3.
    
    Creates a composed flyer by combining a background and foreground template, overlaying the network QR code, rendering the network name (with automatic scaling and line-wrapping), optional "Litter Network" label, contact email, website URL, and Facebook/branding text. Saves the full-size image and a 1/5-size thumbnail to predetermined S3 paths.
    
    Parameters:
        net (str): Network identifier to generate the flyer for, or the literal "all" to generate the generic flyer.
        force_generate (bool): If True, regenerate and upload images even if both full and thumbnail already exist on S3. If False, the function exits early when both images are present.
    
    Notes:
        - If required source images, QR image, or font files cannot be opened or loaded, the function prints an error and returns without saving images.
        - The function has no return value; its observable effect is saving image files to S3.
    """
    is_all = ( net == "all")

    # firstly let's generate output file-paths...
    file_name_full = f"flyer-{net}.png"
    file_name_thumb = f"flyer-{net}-thumb.png"

    file_path_full = f'proc/images/resources/flyer/{file_name_full}'
    file_path_thumb = f"proc/images/resources/flyer/" + file_name_thumb

    # ... and see if they already exist on s3:
    if force_generate is False:
        if image_exists_on_s3(file_path_full) and image_exists_on_s3(file_path_thumb):
            return

    # Determine the base directory where the script is located
    base_dir = os.path.dirname(os.path.abspath(__file__))

    # Environment setup
    # In Pillow, fonts are loaded directly, so no need to set GDFONTPATH
    text_colour = (255, 255, 255)  # White

    # Font files
    font_source_serif = os.path.join(base_dir, 'fonts/SourceSerifPro-Regular.otf')
    font_poppins = os.path.join(base_dir, 'fonts/Poppins-Regular.otf')
    font_poppins_m = os.path.join(base_dir, 'fonts/Poppins-Medium.otf')
    font_poppins_b = os.path.join(base_dir, 'fonts/Poppins-Bold.otf')

    # Get network info
    selected_network_info = get_network_info(net)

    # Image templates
    image_path_template = os.path.join(base_dir, "source", "flyer-template.png")
    image_path_background = os.path.join(base_dir, "source", "flyer-defaultbackground.png")

    try:
        image_fg = Image.open(image_path_template).convert("RGBA")
    except IOError:
        print(f"Error: Cannot open foreground template {image_path_template}")
        return

    try:
        image = Image.open(image_path_background).convert("RGBA")
    except IOError:
        print(f"Error: Cannot open background image {image_path_background}")
        return

    # Overlay foreground onto background
    image = Image.alpha_composite(image, image_fg)

    had_errors = False

    # Add QR code to image
    image_qr = load_image_from_s3(f'proc/images/resources/qr/qr-{net}.png');

    # Resize QR code to 360x360
    image_qr = image_qr.resize((360, 360), Image.Resampling.LANCZOS)
    # Paste QR code at (2020, 2450)
    image.paste(image_qr, (2020, 2450), image_qr)

    # Add network name to image
    selected_network_logo_name = selected_network_info.get("logoName") or selected_network_info.get("fullName", "")
    lines = selected_network_logo_name.split("|")
    num_lines = len(lines)

    text_y = 550 if is_all else 380 if num_lines > 1 else 430
    font_size = 260 if num_lines > 1 else 340

    font_scale = 1.2;

    draw = ImageDraw.Draw(image)

    for line in lines:
        # Load font
        try:
            font = ImageFont.truetype(font_source_serif, font_scale * font_size)
        except IOError:
            print(f"Error: Cannot load font {font_source_serif}")
            return

        # Calculate text size
        text_box = draw.textbbox((0,0), line, font=font)
        text_width = text_box[2] - text_box[0]
        text_height = text_box[3] - text_box[1]

        # Scale text if too wide
        line_scale = 1.0
        if text_width > (image.width * 0.9):
            line_scale = (image.width * 0.9) / text_width
            scaled_font_size = int(font_scale * font_size * line_scale)
            try:
                font = ImageFont.truetype(font_source_serif, scaled_font_size)
            except IOError:
                print(f"Error: Cannot load font {font_source_serif}")
                return
            text_box = draw.textbbox((0,0), line, font=font)
            text_width = text_box[2] - text_box[0]
            text_height = text_box[3] - text_box[1]

        # Calculate X position to center the text
        line_x = (image.width / 2) - (text_width / 2)

        # Draw text
        draw.text((line_x, text_y), line, font=font, fill=text_colour)

        # Update Y position
        text_y += 320

    # Add "Litter Network" text
    if not is_all:
        text_y += 100 if num_lines > 1 else 230
        font_size_litter = 130
        line = "Litter Network"

        try:
            font_litter = ImageFont.truetype(font_poppins_m, font_size_litter)
        except IOError:
            print(f"Error: Cannot load font {font_poppins_m}")
            return

        text_box = draw.textbbox((0,0), line, font=font_litter)
        text_width = text_box[2] - text_box[0]
        text_height = text_box[3] - text_box[1]

        line_x = (image.width / 2) - (text_width / 2)
        draw.text((line_x, text_y), line, font=font_litter, fill=text_colour)

    # Lower font settings
    lower_font_size = 76
    max_width_left_side = 1050
    text_sep_y = 100  # Assuming a separation value, since it's undefined in PHP

    # Draw email text
    text_x = 300
    text_y = 3000

    selected_network_email = selected_network_info.get("contactEmail", "")
    email_text = selected_network_email if selected_network_email else "contact@litternetworks.org"

    try:
        font_email = ImageFont.truetype(font_poppins_m, lower_font_size)
    except IOError:
        print(f"Error: Cannot load font {font_poppins_m}")
        return

    text_box = draw.textbbox((0,0), email_text, font=font_email)
    text_width = text_box[2] - text_box[0]

    text_scale = min(max_width_left_side / text_width, 1.0)
    scaled_font_size = int(lower_font_size * text_scale)

    try:
        font_email_scaled = ImageFont.truetype(font_poppins_m, scaled_font_size)
    except IOError:
        print(f"Error: Cannot load font {font_poppins_m}")
        return

    draw.text((text_x, text_y), email_text, font=font_email_scaled, fill=text_colour)
    text_y += text_sep_y

    # Draw web-address text
    text_x = 300
    text_y = 3250

    selected_network_url = "litternetworks.org" if is_all else f"litternetworks.org/{selected_network_info.get('shortId', '')}"

    text_box = draw.textbbox((0,0), selected_network_url, font=font_email_scaled)
    text_width = text_box[2] - text_box[0]

    text_scale = min(max_width_left_side / text_width, 1.0)
    scaled_font_size = int(lower_font_size * text_scale)

    try:
        font_url_scaled = ImageFont.truetype(font_poppins_m, scaled_font_size)
    except IOError:
        print(f"Error: Cannot load font {font_poppins_m}")
        return

    draw.text((text_x, text_y), selected_network_url, font=font_url_scaled, fill=text_colour)
    text_y += text_sep_y

    # Add Facebook info
    selected_network_name = selected_network_info.get("fullName", "")
    fb_lines = ["\"Litter Networks\""] if is_all else [f"\"{selected_network_name}", "Litter Network\""]
    num_fb_lines = len(fb_lines)

    text_x = 1895
    text_y_fb = 3250
    font_size_fb = 68

    is_first_line = True

    for line in fb_lines:
        actual_line = line
        try:
            font_fb = ImageFont.truetype(font_poppins_b, font_size_fb)
        except IOError:
            print(f"Error: Cannot load font {font_poppins_b}")
            return

        text_box = draw.textbbox((0,0), actual_line, font=font_fb)
        text_width = text_box[2] - text_box[0]
        text_height = text_box[3] - text_box[1]

        line_x = text_x - (text_width / 2)

        draw.text((line_x, text_y_fb), actual_line, font=font_fb, fill=text_colour)

        is_first_line = False
        text_y_fb += 100
    
    # Save image with alpha channel preserved
    image = image.convert("RGBA")

    # Handle thumbnail
    thumbnail_size = (image.width // 5, image.height // 5)
    image_thumb = image.resize(thumbnail_size, Image.Resampling.LANCZOS)

    save_image_to_s3(image, file_path_full)
    save_image_to_s3(image_thumb, file_path_thumb)

def main():

    """
    Entry point that generates flyer images for either a single network or all networks.
    
    When configured for single-file mode, invokes generation for the hard-coded network "anfieldlitter".
    Otherwise, retrieves all network IDs and invokes flyer generation for each, displaying a progress bar during the batch run.
    """
    isSingleFileMode = True

    if isSingleFileMode:
        generate_flyer(net="anfieldlitter")
    else:
        # Fetch all uniqueIds from the table
        unique_ids = get_all_network_ids()

        from tqdm import tqdm
        
        # Loop over each uniqueId and perform the desired action
        for unique_id in tqdm(unique_ids, desc="Processing Flyer Images"):
            generate_flyer(net=unique_id)

if __name__ == '__main__':
    main()
