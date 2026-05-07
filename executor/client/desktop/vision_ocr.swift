import Foundation
import ImageIO
import Vision

func fail(_ message: String) -> Never {
    if let data = message.data(using: .utf8) {
        FileHandle.standardError.write(data)
    }
    exit(1)
}

guard CommandLine.arguments.count >= 2 else {
    fail("usage: vision_ocr.swift <image-path>\n")
}

let imagePath = CommandLine.arguments[1]
let imageURL = URL(fileURLWithPath: imagePath)

guard
    let source = CGImageSourceCreateWithURL(imageURL as CFURL, nil),
    let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
    let widthNumber = properties[kCGImagePropertyPixelWidth] as? NSNumber,
    let heightNumber = properties[kCGImagePropertyPixelHeight] as? NSNumber
else {
    fail("failed to read image metadata\n")
}

let imageWidth = widthNumber.doubleValue
let imageHeight = heightNumber.doubleValue

let request = VNRecognizeTextRequest()
request.recognitionLevel = .accurate
request.usesLanguageCorrection = true
request.recognitionLanguages = ["zh-Hans", "zh-Hant", "en-US"]

let handler = VNImageRequestHandler(url: imageURL, options: [:])
do {
    try handler.perform([request])
} catch {
    fail("ocr request failed: \(error.localizedDescription)\n")
}

var blocks: [[String: Any]] = []
for case let observation as VNRecognizedTextObservation in request.results ?? [] {
    guard let candidate = observation.topCandidates(1).first else {
        continue
    }

    let boundingBox = observation.boundingBox
    let x = Int((boundingBox.minX * imageWidth).rounded())
    let y = Int(((1.0 - boundingBox.maxY) * imageHeight).rounded())
    let width = Int((boundingBox.width * imageWidth).rounded())
    let height = Int((boundingBox.height * imageHeight).rounded())

    blocks.append(
        [
            "text": candidate.string,
            "x": max(0, x),
            "y": max(0, y),
            "width": max(1, width),
            "height": max(1, height),
        ]
    )
}

do {
    let data = try JSONSerialization.data(withJSONObject: ["ocr_blocks": blocks], options: [])
    FileHandle.standardOutput.write(data)
} catch {
    fail("failed to serialize OCR payload: \(error.localizedDescription)\n")
}
