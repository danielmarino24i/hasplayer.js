/*
 * The copyright in this software module is being made available under the BSD License, included below. This software module may be subject to other third party and/or contributor rights, including patent rights, and no such rights are granted under this license.
 * The whole software resulting from the execution of this software module together with its external dependent software modules from dash.js project may be subject to Orange and/or other third party rights, including patent rights, and no such rights are granted under this license.
 *
 * Copyright (c) 2014, Orange
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
 * •  Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
 * •  Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
 * •  Neither the name of the Orange nor the names of its contributors may be used to endorse or promote products derived from this software module without specific prior written permission.
 *
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS “AS IS” AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
mpegts.h264.getSequenceHeader = function(data) { // data as Uint8Array

    var pos = -1,
        length = -1,
        i = 0,
        naluType,
        sequenceHeader = null,
        width = 0,
        height = 0;

    while (i < data.length) {
        if ((data[i] === 0x00) && (data[i + 1] === 0x00) && (data[i + 2] === 0x00) && (data[i + 3] === 0x01)) {

            naluType = data[i + 4] & 0x1F;

            // Start of SPS or PPS
            if ((naluType >= mpegts.h264.NALUTYPE_SPS) && (naluType <= mpegts.h264.NALUTYPE_PPS)) {
                // First NALU of this type => we start storing the sequence header
                if (pos === -1) {
                    pos = i;
                }

                // SPS => parse to get width and height
                if (naluType === mpegts.h264.NALUTYPE_SPS) {
                    var sps = mpegts.h264.parseSPS(data.subarray(i + 5)); // +5 => after nal_unit_type byte
                    width = (sps.pic_width_in_mbs_minus1 + 1) << 4;
                    height = (sps.pic_height_in_map_units_minus1 + 1) << 4;
                }
            } else if (pos > 0) {
                length = i - pos;
            }

            // Start of coded picture NALU
            if ((naluType === mpegts.h264.NALUTYPE_IDR) || (naluType === mpegts.h264.NALUTYPE_NONIDR)) {
                break;
            }

            i += 4;
        } else if ((data[i] === 0x00) && (data[i + 1] === 0x00) && (data[i + 2] === 0x01)) {
            if (pos > 0) {
                length = i - pos;
            }
            break;
        } else {
            i++;
        }
    }

    if ((pos === -1) || (length === -1)) {
        return null;
    }

    sequenceHeader = new Uint8Array(length);
    sequenceHeader.set(data.subarray(pos, pos + length));

    return {
        bytes: sequenceHeader,
        width: width,
        height: height
    };
};

mpegts.h264.read_ue = function(data, ctx) {

    var value = 1,
        temp = 0,
        numZeros = 0;

    ctx._bit = (ctx._byte >> ctx._bitPos) & 0x01;
    ctx._bitPos--;
    if (ctx._bitPos < 0) {
        ctx._byte = data[ctx._bytePos];
        ctx._bytePos++;
        ctx._bitPos = 7;
    }

    while (ctx._bit === 0) {
        numZeros++;
        value = value << 1;
        ctx._bit = (ctx._byte >> ctx._bitPos) & 0x01;
        ctx._bitPos--;
        if (ctx._bitPos < 0) {
            ctx._byte = data[ctx._bytePos];
            ctx._bytePos++;
            ctx._bitPos = 7;
        }
    }

    value -= 1;
    temp = 0;
    if (numZeros) {
        while (numZeros > 0) {
            ctx._bit = (ctx._byte >> ctx._bitPos) & 0x01;
            ctx._bitPos--;
            temp = (temp << 1) + ctx._bit;
            numZeros--;
            if (ctx._bitPos < 0) {
                ctx._byte = data[ctx._bytePos];
                ctx._bytePos++;
                ctx._bitPos = 7;
            }
        }
    }
    value += temp;

    return value;
};

mpegts.h264.read_flag = function(data, ctx) {

    var value = 0;

    ctx._bit = (ctx._byte >> ctx._bitPos) & 0x01;
    ctx._bitPos--;
    if (ctx._bitPos < 0) {
        ctx._byte = data[ctx._bytePos];
        ctx._bytePos++;
        ctx._bitPos = 7;
    }
    value = ctx._bit;

    return value;
};


mpegts.h264.parseSPS = function(data) {

    var sps = {
            profile_idc: 0,
            constraint_set0_flag: 0,
            constraint_set1_flag: 0,
            constraint_set2_flag: 0,
            constraint_set3_flag: 0,
            level_idc: 0,
            seq_parameter_set_id: 0,
            chroma_format_idc: 0,
            separate_colour_plane_flag: 0,
            bit_depth_luma_minus8: 0,
            bit_depth_chroma_minus8: 0,
            qpprime_y_zero_transform_bypass_flag: 0,
            seq_scaling_matrix_present_flag: 0,
            log2_max_frame_num_minus4: 0,
            pic_order_cnt_type: 0,
            log2_max_pic_order_cnt_lsb_minus4: 0,
            num_ref_frames: 0,
            gaps_in_frame_num_value_allowed_flag: 0,
            pic_width_in_mbs_minus1: 0,
            pic_height_in_map_units_minus1: 0
        },

        ctx = {
            _byte: 0,
            _bit: 0,
            _bytePos: 0,
            _bitPos: 0
        };


    ctx._bytePos = ctx._bitPos = 0;

    // profile_idc - u(8)
    ctx._byte = data[ctx._bytePos];
    ctx._bytePos++;
    sps.profile_idc = ctx._byte;

    // constraint_set_flag (0/1/2/3 + reserved bits) - u(8)
    ctx._byte = data[ctx._bytePos];
    ctx._bytePos++;
    sps.constraint_set0_flag = (ctx._byte & 0x80) >> 7;
    sps.constraint_set1_flag = (ctx._byte & 0x40) >> 6;
    sps.constraint_set2_flag = (ctx._byte & 0x20) >> 5;
    sps.constraint_set3_flag = (ctx._byte & 0x10) >> 4;

    // level_idc - u(8)
    ctx._byte = data[ctx._bytePos];
    ctx._bytePos++;
    sps.level_idc = ctx._byte;

    // seq_parameter_set_id - ue(v)
    ctx._byte = data[ctx._bytePos];
    ctx._bytePos++;
    ctx._bitPos = 7;
    sps.seq_parameter_set_id = mpegts.h264.read_ue(data, ctx);

    if ((sps.profile_idc === 100) ||
        (sps.profile_idc === 110) ||
        (sps.profile_idc === 122) ||
        (sps.profile_idc === 244) ||
        (sps.profile_idc === 44) ||
        (sps.profile_idc === 83) ||
        (sps.profile_idc === 86)) {

        // chroma_format_idc - ue(v)
        sps.chroma_format_idc = mpegts.h264.read_ue(data, ctx);

        if (sps.chroma_format_idc === 3) {
            // separate_colour_plane_flag - u(1)
            sps.separate_colour_plane_flag = mpegts.h264.read_flag(data, ctx);
        }

        // bit_depth_luma_minus8 - ue(v)
        sps.bit_depth_luma_minus8 = mpegts.h264.read_ue(data, ctx);

        // bit_depth_chroma_minus8 - ue(v)
        sps.bit_depth_chroma_minus8 = mpegts.h264.read_ue(data, ctx);

        // qpprime_y_zero_transform_bypass_flag - u(1)
        sps.qpprime_y_zero_transform_bypass_flag = mpegts.h264.read_flag(data, ctx);

        // seq_scaling_matrix - u(1)
        sps.seq_scaling_matrix_present_flag = mpegts.h264.read_flag(data, ctx);

        if (sps.seq_scaling_matrix_present_flag === 1) {
            // NOT IMPLEMENTED
            //console.log("H.264 SPS parsing: (seq_scaling_matrix_present_flag = 1) not implemented");
        }
    }

    // log2_max_frame_num_minus4 - ue(v)
    sps.log2_max_frame_num_minus4 = mpegts.h264.read_ue(data, ctx);

    // pic_order_cnt_type - ue(v)
    sps.pic_order_cnt_type = mpegts.h264.read_ue(data, ctx);

    if (sps.pic_order_cnt_type === 0) {
        // log2_max_pic_order_cnt_lsb_minus4 - ue(v)
        sps.log2_max_pic_order_cnt_lsb_minus4 = mpegts.h264.read_ue(data, ctx);
    } else if (sps.pic_order_cnt_type === 1) {
        // NOT IMPLEMENTED
        //console.log("H.264 SPS parsing: (log2_max_pic_order_cnt_lsb_minus4 = 1) not implemented");
    }

    // num_ref_frames - ue(v)
    sps.num_ref_frames = mpegts.h264.read_ue(data, ctx);

    // gaps_in_frame_num_value_allowed_flag - u(1)
    sps.gaps_in_frame_num_value_allowed_flag = mpegts.h264.read_flag(data, ctx);

    // pic_width_in_mbs_minus1 - ue(v)
    sps.pic_width_in_mbs_minus1 = mpegts.h264.read_ue(data, ctx);

    // pic_height_in_map_units_minus1 - ue(v)
    sps.pic_height_in_map_units_minus1 = mpegts.h264.read_ue(data, ctx);

    return sps;
};

mpegts.h264.parseNALUs = function(data) { // data as Uint8Array

    var i = 0,
        length = data.length,
        numZeroBytes = 0,
        nalus = [],
        nalu;

    // console.log("[H264] PARSE NALUs ------------------------------------------");
    while (i < length) {
        if (data[i] === 0) {
            numZeroBytes++;
        }
        if ((data[i] === 1) && (numZeroBytes >= 2)) {
            i++;
            // Update previous NALU size
            if (nalus.length > 0) {
                nalus[nalus.length - 1].size = i - (numZeroBytes + 1) - nalus[nalus.length - 1].offset;
            }

            nalu = {};
            nalu.type = data[i] & 0x1F;
            nalu.offset = i;
            nalus.push(nalu);

            // console.log("[H264] NALU: SC = " + (numZeroBytes + 1) + ", type = " + nalu.type);
            numZeroBytes = 0;
        }
        if (data[i]) {
            numZeroBytes = 0;
        }
        i++;
    }

    // Update last NALU size
    if (nalus.length > 0) {
        nalus[nalus.length - 1].size = i - nalus[nalus.length - 1].offset;
    }

    return nalus;
};


mpegts.h264.bytestreamToMp4 = function(data) { // data as Uint8Array

    var i = 0,
        length = data.length,
        startCodeIndex = -1,
        naluSize = 0;

    while (i < length) {
        if ((data[i] === 0x00) && (data[i + 1] === 0x00) && (data[i + 2] === 0x00) && (data[i + 3] === 0x01)) {

            if (startCodeIndex >= 0) {
                naluSize = (i - startCodeIndex - 4); // 4 = start code length or NALU-size field length
                data[startCodeIndex] = (naluSize & 0xFF000000) >> 24;
                data[startCodeIndex + 1] = (naluSize & 0x00FF0000) >> 16;
                data[startCodeIndex + 2] = (naluSize & 0x0000FF00) >> 8;
                data[startCodeIndex + 3] = (naluSize & 0x000000FF);
                // console.log("[H264] NALU: type = " + (data[i + 4] & 0x1F) + ", size = " + naluSize);
            }

            startCodeIndex = i;
            i += 4;
        } else {
            i++;
        }
    }

    // Last NAL unit
    naluSize = (i - startCodeIndex - 4); // 4 = start code length or NALU-size field length
    data[startCodeIndex] = (naluSize & 0xFF000000) >> 24;
    data[startCodeIndex + 1] = (naluSize & 0x00FF0000) >> 16;
    data[startCodeIndex + 2] = (naluSize & 0x0000FF00) >> 8;
    data[startCodeIndex + 3] = (naluSize & 0x000000FF);
    // console.log("[H264] NALU: type = " + (data[i + 4] & 0x1F) + ", size = " + naluSize);

};

mpegts.h264.isIDR = function(data) { // data as Uint8Array
    var i = 0,
        naluType;

    while (i < data.length) {
        if ((data[i] === 0x00) && (data[i + 1] === 0x00) && (data[i + 2] === 0x01)) {
            naluType = data[i + 3] & 0x1F;
            if (naluType === mpegts.h264.NALUTYPE_IDR) {
                return true;
            }
            i += 3;
        } else {
            i++;
        }
    }
    return false;
};

mpegts.h264.NALUTYPE_NONIDR = 1;
mpegts.h264.NALUTYPE_IDR = 5;
mpegts.h264.NALUTYPE_SEI = 6;
mpegts.h264.NALUTYPE_SPS = 7;
mpegts.h264.NALUTYPE_PPS = 8;
mpegts.h264.NALUTYPE_AU_DELIMITER = 9;