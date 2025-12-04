#!/usr/bin/python

import os
import shutil
import subprocess

if __name__ == '__main__':
    current_dir = os.path.dirname(os.path.realpath(__file__))
    project_dir = os.path.join(current_dir, '')

    images_dir = ".\images"

    # Pack.
    packer_path = os.path.join(
        project_dir,
        'pack.js'
    )

    outputPath = os.path.join(project_dir, images_dir, 'packed')
    subprocess.Popen([
        'node',
        packer_path,
        '-t',
        'remote',
        '-a',
        'http://10.10.50.17:3456',
        '-i',
        os.path.join(project_dir, images_dir, 'texture_packer.json'),
        '-o',
        outputPath
    ]).wait()

    # Copy packed images to assets/game/images
    assets_images_dir = os.path.join(project_dir, '..', 'src', 'assets', 'game', 'images')
    assets_images_dir = os.path.normpath(assets_images_dir)
    
    if os.path.exists(outputPath):
        # Copy all files from packed directory to assets/game/images
        for filename in os.listdir(outputPath):
            src_file = os.path.join(outputPath, filename)
            dst_file = os.path.join(assets_images_dir, filename)
            
            if os.path.isfile(src_file):
                shutil.copy2(src_file, dst_file)
                print(f"Copied {filename} to {assets_images_dir}")

